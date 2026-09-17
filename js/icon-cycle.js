/* wirezat-ui-v1 / js/icon-cycle.js
   Rotates an <img> through several images.

   initIconCycle(scope?)
     Wires every [data-wui-cycle] within scope (default: document). Safe to call
     repeatedly; already-wired images are skipped. A clone of a wired image
     (an overlay built from a hidden template, say) is a new element and is
     wired afresh.

   The attribute holds a JSON array of frames. Each frame carries the whole
   presentation of the image while it is shown, not just its source:

     [{"src": "/a.png"},
      {"src": "/b.png", "cls": "icon sheet-play", "style": "--frames:32"}]

   `cls` and `style` are optional and replace the element's own when present —
   which is the point: two images that need different object-fit or animation
   cannot share one set of attributes, and swapping only the source would render
   the second one with the first one's rules.

   A frame may also carry a `label`:

     [{"src": "/a.png", "label": "Copper Ore"},
      {"src": "/b.png", "label": "Deepslate Copper Ore"}]

   It is written into the image's paired [data-wui-cycle-label] element as the
   frame shows, so a title can name what the image currently stands for. The
   pair is found by containment — the first [data-wui-cycle-label] inside the
   nearest ancestor that holds one — so generated markup needs no ids, and an
   image and its label only have to share a container.

   Use it where one slot legitimately stands for several things and picking one
   would misrepresent the rest.

   One shared timer drives every wired image, so they advance in step instead of
   drifting apart into visual noise. Images that have left the document are
   dropped on the next tick, which is what keeps re-rendered lists from leaking.
*/

const CYCLE_MS = 1000;   // JEI's cadence: long enough to read, short enough to notice

const _wired    = new Set();       // { el, frames, label }
const _wiredEls = new WeakSet();   // elements already in _wired
let   _timer    = null;
let   _tick     = 0;

export function initIconCycle(scope = document) {
    scope.querySelectorAll('[data-wui-cycle]').forEach(el => {
        if (_wiredEls.has(el)) return;

        let frames;
        try {
            frames = JSON.parse(el.dataset.wuiCycle);
        } catch {
            return;   // malformed list: leave the element as authored
        }
        if (!Array.isArray(frames) || frames.length < 2) return;
        if (!frames.every(f => f && typeof f.src === 'string')) return;

        _wiredEls.add(el);
        const label = frames.some(f => typeof f.label === 'string') ? _labelFor(el) : null;
        _wired.add({ el, frames, label });
    });

    if (_wired.size && _timer === null) {
        _timer = setInterval(_advance, CYCLE_MS);
    }
}

function _labelFor(el) {
    for (let node = el.parentElement; node; node = node.parentElement) {
        const label = node.querySelector('[data-wui-cycle-label]');
        if (label) return label;
    }
    return null;
}

function _advance() {
    _tick++;
    for (const entry of _wired) {
        if (!entry.el.isConnected) {
            _wired.delete(entry);
            continue;
        }
        _show(entry, entry.frames[_tick % entry.frames.length]);
    }
    if (_wired.size === 0) {
        clearInterval(_timer);
        _timer = null;
    }
}

function _show({ el, label }, frame) {
    if (el.getAttribute('src') !== frame.src) {
        el.setAttribute('src', frame.src);
    }
    // Only touched when the frame says so, so a caller that cycles plain images
    // keeps whatever classes and styles the element was authored with.
    if (frame.cls !== undefined && el.getAttribute('class') !== frame.cls) {
        el.setAttribute('class', frame.cls);
    }
    if (frame.style !== undefined && el.getAttribute('style') !== frame.style) {
        el.setAttribute('style', frame.style);
    }
    if (label && typeof frame.label === 'string' && label.textContent !== frame.label) {
        label.textContent = frame.label;
    }
}
