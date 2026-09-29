/* wirezat-ui-v1 / js/autocomplete.js
   Virtual-scrolling autocomplete dropdown.

   Usage:
     new WuiAutocomplete({
       inputEl,            // <input> element
       dropEl,             // .wui-ac-drop element (sibling of input inside .wui-ac-wrap)
       fetch,              // async (q, offset) => { rows: [...], hasMore: bool }
       onSelect,           // (row) => void | true  — return true to keep the dropdown open
       primary,            // (row) => string  — main display value
       secondary?,         // (row) => string  — optional secondary display value
       variant?,           // (row) => string  — adds class ac-<name> to the row (danger, warn, success)
       icon?,              // (row) => html    — trusted markup in a fixed-width leading cell
       onRender?,          // (dropEl) => void — after rows are inserted
       preselect?,         // default true — highlight the first row after each search
       debounceMs?,        // default 180
     })

   destroy() closes the dropdown and removes the window listeners.

   fetch() receives (query, offset) and must return { rows, hasMore }.
   Rows are plain objects; primary/secondary extract display strings from them.
   Virtual window: up to 50 rows rendered at once; scrolling loads more.
*/

const PAGE = 50;
const MAX  = 150;

export class WuiAutocomplete {
  constructor({ inputEl, dropEl, fetch, onSelect, primary, secondary, variant, icon, onRender, preselect = true, debounceMs = 180 }) {
    this._in   = inputEl;
    this._drop = dropEl;
    this._fetch  = fetch;
    this._onSel  = onSelect;
    this._pri    = primary;
    this._sec    = secondary || null;
    this._variant   = variant || null;
    this._icon      = icon || null;
    this._onRender  = onRender || null;
    this._preselect = preselect;

    this._buf      = [];
    this._active   = -1;
    this._off      = 0;
    this._bufStart = 0;
    this._hasMore  = false;
    this._loading  = false;
    this._q        = null;
    this._closeT   = null;

    this._search = _debounce(() => this._newSearch(), debounceMs);

    inputEl.addEventListener('input',   () => this._search());
    inputEl.addEventListener('focus',   () => this._tryOpen());
    inputEl.addEventListener('click',   () => this._tryOpen());
    inputEl.addEventListener('keydown', e  => this._keydown(e));
    inputEl.addEventListener('blur',    () => this._schedClose());

    dropEl.addEventListener('mousedown', e => e.preventDefault());
    dropEl.addEventListener('click', e => {
      const row = e.target.closest('.wui-ac-row');
      if (!row) return;
      this._select(+row.dataset.idx);
    });
    dropEl.addEventListener('scroll', () => this._onScroll());

    this._repos = () => { if (dropEl.classList.contains('open')) this._pos(); };
    window.addEventListener('scroll', this._repos, { passive: true, capture: true });
    window.addEventListener('resize', this._repos, { passive: true });
  }

  close() {
    clearTimeout(this._closeT);
    this._buf = []; this._q = null; this._active = -1;
    this._drop.classList.remove('open');
  }

  destroy() {
    this.close();
    window.removeEventListener('scroll', this._repos, { capture: true });
    window.removeEventListener('resize', this._repos);
  }

  _tryOpen() {
    const q = this._in.value;
    if (this._buf.length && this._q === q) {
      this._pos();
      this._drop.classList.add('open');
    } else {
      this._search();
    }
  }

  async _newSearch() {
    const q = this._in.value;
    this._buf = []; this._active = -1; this._off = 0; this._bufStart = 0;
    this._hasMore = true; this._q = q;
    this._drop.classList.remove('open');
    this._loading = true;
    try {
      const { rows, hasMore } = await this._fetch(q, 0);
      if (this._q !== q) return;
      this._buf     = rows;
      this._off     = rows.length;
      this._hasMore = hasMore;
      this._active  = rows.length && this._preselect ? 0 : -1;
      this._render();
    } finally {
      this._loading = false;
    }
  }

  async _onScroll() {
    if (this._loading) return;
    const d = this._drop;

    if (d.scrollTop + d.clientHeight >= d.scrollHeight - 80) {
      await this._loadForward();
    } else if (d.scrollTop < 80 && this._bufStart > 0) {
      await this._loadBackward();
    }
  }

  // Fetches and appends the next page, trimming rows off the top past MAX.
  async _loadForward() {
    if (!this._hasMore) return;
    this._loading = true;
    try {
      const q = this._q;
      const { rows, hasMore } = await this._fetch(q, this._off);
      if (this._q !== q) return;
      this._off    += rows.length;
      this._hasMore = hasMore;
      if (!rows.length) return;

      const d = this._drop;
      const excess = this._buf.length + rows.length - MAX;
      if (excess > 0) {
        const trim = Math.min(excess, this._buf.length);
        const h    = d.children[0]?.offsetHeight || 34;
        const top  = d.scrollTop;
        for (let i = 0; i < trim; i++) d.children[0]?.remove();
        this._buf      = this._buf.slice(trim);
        this._bufStart += trim;
        this._active   = this._active >= 0 ? Math.max(0, this._active - trim) : -1;
        d.scrollTop    = Math.max(0, top - trim * h);
      }

      const frag = document.createDocumentFragment();
      rows.forEach(row => {
        const el = document.createElement('div');
        el.className = 'wui-ac-row' + this._rowClass(row);
        el.innerHTML  = this._rowHTML(row);
        frag.appendChild(el);
      });
      d.appendChild(frag);
      this._buf = [...this._buf, ...rows];
      this._reindex();
      this._onRender?.(this._drop);
    } finally {
      this._loading = false;
    }
  }

  // Fetches and prepends the page before the buffer, trimming rows off the bottom past MAX.
  async _loadBackward() {
    this._loading = true;
    try {
      const q          = this._q;
      const fetchStart = Math.max(0, this._bufStart - PAGE);
      const { rows }   = await this._fetch(q, fetchStart);
      if (this._q !== q) return;
      const newRows = rows.slice(0, Math.max(0, this._bufStart - fetchStart));
      if (!newRows.length) return;

      const d = this._drop;
      this._bufStart = fetchStart;

      const excess = this._buf.length + newRows.length - MAX;
      if (excess > 0) {
        const trim = Math.min(excess, this._buf.length);
        for (let i = 0; i < trim; i++) d.lastElementChild?.remove();
        this._buf     = this._buf.slice(0, this._buf.length - trim);
        this._hasMore = true;
      }

      const h   = d.children[0]?.offsetHeight || 34;
      const top = d.scrollTop;
      const frag = document.createDocumentFragment();
      newRows.forEach(row => {
        const el = document.createElement('div');
        el.className = 'wui-ac-row' + this._rowClass(row);
        el.innerHTML  = this._rowHTML(row);
        frag.appendChild(el);
      });
      d.prepend(frag);
      this._buf   = [...newRows, ...this._buf];
      this._active = this._active >= 0 ? this._active + newRows.length : -1;
      d.scrollTop  = top + newRows.length * h;
      this._reindex();
      this._onRender?.(this._drop);
    } finally {
      this._loading = false;
    }
  }

  // Syncs each row's data-idx to its position in _buf.
  _reindex() {
    Array.from(this._drop.children).forEach((el, i) => { el.dataset.idx = i; });
  }

  _render() {
    const d = this._drop;
    if (!this._buf.length) { d.classList.remove('open'); return; }
    this._pos();
    d.innerHTML = this._buf.map((row, i) =>
      `<div class="wui-ac-row${this._rowClass(row)}${i === this._active ? ' ac-active' : ''}" data-idx="${i}">${this._rowHTML(row)}</div>`
    ).join('');
    d.classList.add('open');
    this._onRender?.(this._drop);
  }

  _rowHTML(row) {
    const i = this._icon ? `<span class="wui-ac-icon">${this._icon(row) || ''}</span>` : '';
    const p = esc(this._pri(row));
    const s = this._sec ? `<span class="wui-ac-secondary">${esc(this._sec(row))}</span>` : '';
    return `${i}<span class="wui-ac-primary">${p}</span>${s}`;
  }

  _rowClass(row) {
    const v = this._variant ? this._variant(row) : '';
    return v && /^[a-z][a-z0-9-]*$/.test(v) ? ' ac-' + v : '';
  }

  _pos() {
    const r = this._in.getBoundingClientRect();
    const d = this._drop.style;
    d.top   = (r.bottom - 1) + 'px';
    d.left  = r.left + 'px';
    d.width = r.width + 'px';
  }

  _select(i) {
    const row = this._buf[i];
    if (!row) return;
    if (!this._onSel(row)) this.close();
  }

  _schedClose() {
    clearTimeout(this._closeT);
    this._closeT = setTimeout(() => this.close(), 150);
  }

  _keydown(e) {
    if (!this._buf.length) return;
    const n = this._buf.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._active = Math.min(this._active + 1, n - 1);
      this._updActive();
      this._drop.children[this._active]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this._active = Math.max(this._active - 1, 0);
      this._updActive();
      this._drop.children[this._active]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (this._active >= 0) { e.preventDefault(); this._select(this._active); }
    } else if (e.key === 'Escape') {
      this.close();
    }
  }

  _updActive() {
    Array.from(this._drop.children).forEach((el, i) =>
      el.classList.toggle('ac-active', i === this._active));
  }
}

function _debounce(fn, ms) {
  let t;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
