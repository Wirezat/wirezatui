/* wirezat-ui-v1 / js/infocard.js
   Hover-triggered info card overlay.

   initInfocards(scope?)
     Wires all infocard triggers within scope (default: document).
     Safe to call multiple times; already-wired triggers are skipped.

   Two trigger modes:

   1. ID mode — data-infocard="some-id"
      The definition is a .infocard-def element with id="some-id" anywhere
      in the document.

   2. Inline mode — data-infocard-inline (boolean attribute, no value)
      The definition is the immediately following sibling element with class
      .infocard-def. Use this when trigger and def are generated together as
      a self-contained unit (no global ID needed).

   In both modes the definition's innerHTML is cloned into a live .infocard
   overlay appended to <body> and positioned above the trigger.

   Grid column count: use data-cols on .infocard-grid — initInfocards sets
   the --_ic-cols CSS variable from it after cloning.
*/

let _active    = null;   // { overlay, def }
let _showTimer = null;
let _hideTimer = null;

const SHOW_DELAY = 120;  // ms before card appears
const HIDE_DELAY = 80;   // ms grace when moving between trigger and card

export function initInfocards(scope = document) {
    scope.querySelectorAll('[data-infocard], [data-infocard-inline]').forEach(trigger => {
        if (trigger.dataset.wuiInfocardWired) return;
        trigger.dataset.wuiInfocardWired = '1';
        trigger.addEventListener('mouseenter', () => _scheduleShow(trigger));
        trigger.addEventListener('mouseleave', () => _scheduleHide());
    });
}

function _findDef(trigger) {
    if ('infocardInline' in trigger.dataset) {
        const sib = trigger.nextElementSibling;
        return sib?.classList.contains('infocard-def') ? sib : null;
    }
    return document.getElementById(trigger.dataset.infocard);
}

function _scheduleShow(trigger) {
    clearTimeout(_hideTimer);
    _hideTimer = null;

    const def = _findDef(trigger);
    if (!def || _active?.def === def) return;

    clearTimeout(_showTimer);
    _showTimer = setTimeout(() => {
        _showTimer = null;
        _show(trigger, def);
    }, SHOW_DELAY);
}

function _scheduleHide() {
    clearTimeout(_showTimer);
    _showTimer = null;
    _hideTimer = setTimeout(_hide, HIDE_DELAY);
}

function _show(trigger, def) {
    _hide();

    const overlay = document.createElement('div');
    overlay.className = 'infocard';
    overlay.setAttribute('role', 'tooltip');
    overlay.innerHTML = def.innerHTML;

    overlay.querySelectorAll('.infocard-grid[data-cols]').forEach(grid => {
        grid.style.setProperty('--_ic-cols', grid.dataset.cols);
    });

    overlay.addEventListener('mouseenter', () => {
        clearTimeout(_hideTimer);
        _hideTimer = null;
    });
    overlay.addEventListener('mouseleave', () => _scheduleHide());

    document.body.appendChild(overlay);
    _active = { overlay, def };

    _position(trigger, overlay);
}

function _hide() {
    if (_active) {
        _active.overlay.remove();
        _active = null;
    }
}

function _position(trigger, overlay) {
    const tr  = trigger.getBoundingClientRect();
    const ow  = overlay.offsetWidth;
    const oh  = overlay.offsetHeight;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const gap = 8;

    let top  = tr.top - oh - gap;
    let left = tr.left + tr.width / 2 - ow / 2;

    if (top < gap) top = tr.bottom + gap;

    if (left + ow > vw - gap) left = vw - ow - gap;
    if (left < gap)           left = gap;

    if (top + oh > vh - gap) top = vh - oh - gap;
    if (top < gap)            top = gap;

    overlay.style.top  = top  + 'px';
    overlay.style.left = left + 'px';
}
