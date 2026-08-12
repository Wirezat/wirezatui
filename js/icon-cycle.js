/* wirezat-ui-v1 / js/icon-cycle.js
   Rotates an <img> through several images.

   initIconCycle(scope?)
     Wires every [data-wui-cycle] within scope (default: document). Safe to call
     repeatedly; already-wired images are skipped.

   The attribute holds a JSON array of frames. Each frame carries the whole
   presentation of the image while it is shown, not just its source:

     [{"src": "/a.png"},
      {"src": "/b.png", "cls": "icon sheet-play", "style": "--frames:32"}]

   `cls` and `style` are optional and replace the element's own when present —
   which is the point: two images that need different object-fit or animation
   cannot share one set of attributes, and swapping only the source would render
   the second one with the first one's rules.

   Use it where one slot legitimately stands for several things and picking one
   would misrepresent the rest.

   One shared timer drives every wired image, so they advance in step instead of
   drifting apart into visual noise. Images that have left the document are
   dropped on the next tick, which is what keeps re-rendered lists from leaking.
*/

const CYCLE_MS = 1000;   // JEI's cadence: long enough to read, short enough to notice

const _wired = new Set();   // { el, frames }
let   _timer = null;
let   _tick  = 0;

export function initIconCycle(scope = document) {
    scope.querySelectorAll('[data-wui-cycle]').forEach(el => {
        if (el.dataset.wuiCycleWired) return;

        let frames;
        try {
            frames = JSON.parse(el.dataset.wuiCycle);
        } catch {
            return;   // malformed list: leave the element as authored
        }
        if (!Array.isArray(frames) || frames.length < 2) return;
        if (!frames.every(f => f && typeof f.src === 'string')) return;

        el.dataset.wuiCycleWired = '1';
        _wired.add({ el, frames });
    });

    if (_wired.size && _timer === null) {
        _timer = setInterval(_advance, CYCLE_MS);
    }
}

function _advance() {
    _tick++;
    for (const entry of _wired) {
        if (!entry.el.isConnected) {
            _wired.delete(entry);
            continue;
        }
        _show(entry.el, entry.frames[_tick % entry.frames.length]);
    }
    if (_wired.size === 0) {
        clearInterval(_timer);
        _timer = null;
    }
}

function _show(el, frame) {
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
}
