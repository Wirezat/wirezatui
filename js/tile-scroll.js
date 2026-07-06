/* wirezat-ui-v1 / js/tile-scroll.js
   Infinite marquee scroll for overflowing .tile-title elements.
   Call initTileScroll(root) after rendering tiles into the DOM.
*/

const GAP_PX  = 64;   // px gap between the two text copies
const SPEED   = 60;   // px per second

export function initTileScroll(root = document) {
    root.querySelectorAll('.tile-title').forEach(el => {
        if (el.querySelector('.tile-title-inner')) return; // already wired
        if (el.scrollWidth <= el.clientWidth + 2) return;  // no overflow

        const text = el.textContent.trim();
        const textW = el.scrollWidth;
        const dur   = Math.max(3, (textW + GAP_PX) / SPEED);

        const inner = document.createElement('span');
        inner.className = 'tile-title-inner';
        inner.style.setProperty('--marquee-shift', `${-(textW + GAP_PX)}px`);
        inner.style.setProperty('--marquee-dur',   `${dur}s`);

        const copy1  = document.createElement('span'); copy1.textContent = text;
        const spacer = document.createElement('span');
        spacer.style.cssText = `display:inline-block;width:${GAP_PX}px;flex-shrink:0`;
        const copy2  = document.createElement('span'); copy2.textContent = text;

        inner.append(copy1, spacer, copy2);
        el.textContent = '';
        el.appendChild(inner);
    });
}
