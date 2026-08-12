/* wirezat-ui-v1 / js/virtual-window.js
   Shared virtual-scroll window: renders a bounded slice of a list near the
   viewport, loading more as the user scrolls forward or back, evicting rows
   that scroll far out of range so the DOM node count stays bounded.

   Two scroll sources:
     scrollMode: 'self'     — container is the scrolling element itself
                              (e.g. WuiAutocomplete's dropdown).
     scrollMode: 'ancestor' — scrollEl is a shared ancestor that scrolls
                              (e.g. a catalog page's .main); several
                              VirtualWindow instances can share one scrollEl,
                              and share one throttled listener on it (see the
                              dispatcher at the bottom of this file).

   fetch(offset) must return { rows, hasMore }. A real network call or a
   synchronous slice of an already-loaded array wrapped in Promise.resolve
   look identical to this class.

   renderRow(row) returns an array of one or more Elements to insert as
   siblings for that one data row — usually one, but a data row can need more
   than one sibling element (catalog-recipes needs a summary <tr> and a
   detail <tr> per recipe), so this is always an array, never a bare Element.
   renderSkeletonRow() follows the same array contract.

   Every async operation captures the current "generation" before awaiting and
   checks it again after — reset() and destroy() both bump it, so a fetch that
   resolves after a reset (new search query) or a destroy (group collapsed)
   is discarded instead of corrupting state that has already moved on.
*/

const DEFAULT_PAGE = 50;
const DEFAULT_MAX = 150;
const EDGE_PX = 80;            // self-mode scrollTop/scrollHeight threshold
const ANCESTOR_EDGE_PX = 300;  // ancestor-mode viewport-rect threshold
const SKELETON_COUNT = 5;

export class VirtualWindow {
  constructor({
    container, scrollMode = 'self', scrollEl = null,
    fetch, renderRow, renderSkeletonRow = null,
    pageSize = DEFAULT_PAGE, maxInDom = DEFAULT_MAX,
  }) {
    this._container = container;
    this._mode = scrollMode;
    this._scrollEl = scrollMode === 'ancestor' ? scrollEl : container;
    this._fetch = fetch;
    this._renderRow = renderRow;
    this._renderSkeletonRow = renderSkeletonRow;
    this._page = pageSize;
    this._max = maxInDom;

    this._buf = [];        // data rows currently backing rendered elements
    this._elGroups = [];   // Element[] per entry in _buf, same index
    this._bufStart = 0;    // offset of _buf[0] in the full result set
    this._off = 0;         // offset the next forward fetch should request
    this._hasMore = false;
    this._loading = false;
    this._loadingGen = null; // which generation the in-flight load (if any) belongs to
    this._skelEls = [];
    this._generation = 0;

    if (this._mode === 'self') {
      this._onScrollBound = () => this.checkViewport();
      this._container.addEventListener('scroll', this._onScrollBound, { passive: true });
    } else {
      _registerAncestor(this._scrollEl, this);
    }
  }

  get rows() { return this._buf; }

  async start() {
    this._generation++;
    const gen = this._generation;
    this._teardownDom();
    this._buf = []; this._elGroups = []; this._bufStart = 0; this._off = 0;
    this._hasMore = true;
    await this._loadForward(gen);
    if (gen === this._generation) this.checkViewport();
  }

  // Re-runs the initial load from scratch — for a caller whose fetch closure
  // reads some external state (a search query) that just changed.
  async reset() { await this.start(); }

  destroy() {
    this._generation++;
    if (this._mode === 'self') {
      this._container.removeEventListener('scroll', this._onScrollBound);
    } else {
      _unregisterAncestor(this._scrollEl, this);
    }
    this._teardownDom();
  }

  _teardownDom() {
    this._clearSkeleton();
    for (const els of this._elGroups) els.forEach(el => el.remove());
    this._elGroups = [];
  }

  // Called by our own scroll listener (self mode) or the shared ancestor
  // dispatcher (ancestor mode) whenever it's worth checking whether more
  // should load.
  checkViewport() {
    if (this._loading) return;
    if (this._mode === 'self') {
      const d = this._container;
      if (d.clientHeight === 0) return; // hidden or not yet laid out — nothing to check yet
      if (d.scrollTop + d.clientHeight >= d.scrollHeight - EDGE_PX) this._loadForward(this._generation);
      else if (d.scrollTop < EDGE_PX && this._bufStart > 0) this._loadBackward(this._generation);
      return;
    }
    // Ancestor mode: our container never scrolls itself, so compare the
    // rendered edges' own position against the ancestor's viewport rect.
    const firstEls = this._elGroups[0];
    const lastEls = this._elGroups[this._elGroups.length - 1];
    if (!firstEls || !lastEls) return;
    const viewport = this._scrollEl.getBoundingClientRect();
    // Skip display:none siblings (e.g. a collapsed detail row), which report a zero rect.
    const lastRect = _laidOutRect(lastEls, true);
    const firstRect = _laidOutRect(firstEls, false);
    // A container with no layout box at all (display:none / [hidden] — e.g. a
    // group filtered out of a search) reports an all-zero rect, which would
    // otherwise read as "sitting at the very top of the page" and pass the
    // forward test forever, draining the whole dataset into a hidden node.
    if (!firstRect.width && !firstRect.height && !lastRect.width && !lastRect.height) return;
    // Both edge tests below are one-sided, so on their own they are also
    // satisfied by content that is nowhere near the viewport: a group scrolled
    // entirely above it has a hugely negative lastRect.bottom (passes the
    // forward test on every frame), one entirely below it has a firstRect.top
    // far past viewport.top (passes the backward test). Only check the edges
    // when the rendered content actually reaches into the extended viewport.
    const nearViewport = lastRect.bottom > viewport.top - ANCESTOR_EDGE_PX &&
                         firstRect.top < viewport.bottom + ANCESTOR_EDGE_PX;
    if (!nearViewport) return;
    if (lastRect.bottom - viewport.bottom < ANCESTOR_EDGE_PX) this._loadForward(this._generation);
    else if (firstRect.top - viewport.top > -ANCESTOR_EDGE_PX && this._bufStart > 0) this._loadBackward(this._generation);
  }

  async _loadForward(gen) {
    // Only block on an in-flight load that belongs to *this same* generation.
    // A load left over from an abandoned generation (reset()/start() raced an
    // earlier fetch that hasn't resolved yet) must not block the new one —
    // otherwise the new generation never fetches anything and the list stays
    // empty forever. See _loadingGen bookkeeping in the finally block below.
    if (!this._hasMore || (this._loading && this._loadingGen === gen)) return;
    this._loading = true;
    this._loadingGen = gen;
    try {
      const offset = this._off;
      const { rows, hasMore } = await this._fetch(offset);
      if (gen !== this._generation) return;
      this._off += rows.length;
      this._hasMore = hasMore;
      this._clearSkeleton();
      if (rows.length) {
        this._trimFromTop(rows.length);
        const frag = document.createDocumentFragment();
        const newGroups = [];
        for (const row of rows) {
          const els = this._renderRow(row);
          newGroups.push(els);
          els.forEach(el => frag.appendChild(el));
        }
        this._container.appendChild(frag);
        this._buf = [...this._buf, ...rows];
        this._elGroups = [...this._elGroups, ...newGroups];
      }
      this._fillSkeleton();
    } finally {
      // Only clear the flag if we still own it — a newer generation's load
      // may have started (and taken ownership of _loading/_loadingGen) while
      // this call's fetch was in flight; in that case we must not clear a
      // flag that no longer describes our own state.
      if (this._loadingGen === gen) this._loading = false;
    }
  }

  async _loadBackward(gen) {
    if (this._loading && this._loadingGen === gen) return;
    this._loading = true;
    this._loadingGen = gen;
    try {
      const fetchStart = Math.max(0, this._bufStart - this._page);
      const { rows } = await this._fetch(fetchStart);
      if (gen !== this._generation) return;
      // A fetch(fetchStart) can return up to a full page starting there;
      // only what precedes our current window is new.
      const newRows = rows.slice(0, Math.max(0, this._bufStart - fetchStart));
      if (!newRows.length) return;

      this._bufStart = fetchStart;
      this._trimFromBottom(newRows.length);

      const scrollTopBefore = this._scrollTop();
      const frag = document.createDocumentFragment();
      const newGroups = [];
      for (const row of newRows) {
        const els = this._renderRow(row);
        newGroups.push(els);
        els.forEach(el => frag.appendChild(el));
      }
      this._container.prepend(frag);
      this._buf = [...newRows, ...this._buf];
      this._elGroups = [...newGroups, ...this._elGroups];
      this._setScrollTop(scrollTopBefore + this._groupsHeight(newGroups));
    } finally {
      if (this._loadingGen === gen) this._loading = false;
    }
  }

  // Scrolling down past maxInDom: drop rows off the top and compensate scroll
  // position by the height removed, so nothing visually jumps.
  _trimFromTop(incomingCount) {
    const excess = this._buf.length + incomingCount - this._max;
    if (excess <= 0) return;
    const trim = Math.min(excess, this._buf.length);
    const removedH = this._groupsHeight(this._elGroups.slice(0, trim));
    const scrollTopBefore = this._scrollTop();
    for (let i = 0; i < trim; i++) this._elGroups[i].forEach(el => el.remove());
    this._buf = this._buf.slice(trim);
    this._elGroups = this._elGroups.slice(trim);
    this._bufStart += trim;
    this._setScrollTop(Math.max(0, scrollTopBefore - removedH));
  }

  // Scrolling up past maxInDom: drop rows off the bottom — the inverse of
  // _trimFromTop. hasMore flips back to true since we just evicted rows past
  // the end that a forward scroll would need to re-fetch.
  _trimFromBottom(incomingCount) {
    const excess = this._buf.length + incomingCount - this._max;
    if (excess <= 0) return;
    const trim = Math.min(excess, this._buf.length);
    const tail = this._elGroups.slice(this._elGroups.length - trim);
    tail.forEach(els => els.forEach(el => el.remove()));
    this._buf = this._buf.slice(0, this._buf.length - trim);
    this._elGroups = this._elGroups.slice(0, this._elGroups.length - trim);
    this._hasMore = true;
    // Resync _off — the sole value _loadForward uses to pick its next fetch
    // offset — to the buffer's real upper bound. Without this, evicting rows
    // off the tail here silently desyncs it from this._bufStart + buf length,
    // permanently orphaning whatever was evicted (a later forward scroll
    // would resume from the stale, too-high _off and skip straight past the
    // evicted range instead of re-fetching it).
    // NB: at this point in the call sequence (called from _loadBackward
    // *before* the caller prepends `incomingCount` new rows onto this._buf),
    // this._buf is only the trimmed *old* tail — the incoming rows aren't in
    // it yet — so the real final length is this._buf.length + incomingCount.
    this._off = this._bufStart + incomingCount + this._buf.length;
  }

  _groupsHeight(groups) {
    let h = 0;
    for (const els of groups) for (const el of els) h += el.offsetHeight;
    return h;
  }

  _scrollTop() { return this._mode === 'self' ? this._container.scrollTop : this._scrollEl.scrollTop; }
  _setScrollTop(v) {
    if (this._mode === 'self') this._container.scrollTop = v;
    else this._scrollEl.scrollTop = v;
  }

  _clearSkeleton() {
    this._skelEls.forEach(el => el.remove());
    this._skelEls = [];
  }

  _fillSkeleton() {
    if (!this._hasMore || !this._renderSkeletonRow) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < SKELETON_COUNT; i++) {
      const els = this._renderSkeletonRow();
      this._skelEls.push(...els);
      els.forEach(el => frag.appendChild(el));
    }
    this._container.appendChild(frag);
  }
}

// Returns the first element's rect (from the back if fromEnd) that has actual layout.
function _laidOutRect(els, fromEnd) {
  const ordered = fromEnd ? [...els].reverse() : els;
  for (const el of ordered) {
    const r = el.getBoundingClientRect();
    if (r.width || r.height) return r;
  }
  return els[fromEnd ? els.length - 1 : 0].getBoundingClientRect();
}

// ── Shared scroll dispatcher for 'ancestor' mode ────────────────────────────
// One `scroll` listener per distinct scrollEl (in practice one per page —
// .main), no matter how many groups are open at once. Each firing is
// throttled to once per animation frame; each check is one
// getBoundingClientRect() per open instance.
const _ancestors = new Map();

function _registerAncestor(scrollEl, instance) {
  let entry = _ancestors.get(scrollEl);
  if (!entry) {
    entry = { instances: new Set(), scheduled: false, listener: null };
    entry.listener = () => {
      if (entry.scheduled) return;
      entry.scheduled = true;
      requestAnimationFrame(() => {
        entry.scheduled = false;
        for (const inst of entry.instances) inst.checkViewport();
      });
    };
    scrollEl.addEventListener('scroll', entry.listener, { passive: true });
    _ancestors.set(scrollEl, entry);
  }
  entry.instances.add(instance);
}

function _unregisterAncestor(scrollEl, instance) {
  const entry = _ancestors.get(scrollEl);
  if (!entry) return;
  entry.instances.delete(instance);
  if (entry.instances.size === 0) {
    scrollEl.removeEventListener('scroll', entry.listener);
    _ancestors.delete(scrollEl);
  }
}
