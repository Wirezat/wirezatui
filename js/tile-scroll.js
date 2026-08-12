/* wirezat-ui-v1 / js/tile-scroll.js
   Hover marquee for overflowing .tile-title elements.
   Call initTileScroll(root) after rendering tiles into the DOM.
*/

import { wireMarquee } from './marquee.js';

export function initTileScroll(root = document) {
    root.querySelectorAll('.tile-title').forEach(el => {
        if (el.querySelector('.tile-title-inner')) return; // already wired

        const inner = document.createElement('span');
        inner.className = 'tile-title-inner';
        inner.textContent = el.textContent.trim();
        el.textContent = '';
        el.appendChild(inner);

        if (!wireMarquee(el, inner)) {
            // Fits: unwrap again so the markup stays as simple as it was.
            el.textContent = inner.textContent;
        }
    });
}
