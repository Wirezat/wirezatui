/* wirezat-ui-v1 / js/marquee.js
   Shared hover-marquee wiring. Measures overflow, duplicates the text with a
   spacer for a seamless loop, and sets the animation custom properties.
   Consumers (table cells, tile titles) call wireMarquee per element.
*/

const SPEED_PX_PER_SEC = 60;
const GAP_PX           = 64;
const MIN_DURATION_SEC = 3;

/**
 * wireMarquee(container, inner)
 * container — the clipping element
 * inner     — the element holding the text; its content is duplicated
 * Returns true when the marquee was wired (text overflows), false otherwise.
 * Idempotent: a second call on an already-wired inner is a no-op.
 *
 * Only a successful wire is recorded. An element that is hidden or zero-width
 * at call time measures as non-overflowing, and must stay re-checkable so a
 * later call (tab shown, section expanded, container resized) can still wire it.
 *
 * Note: the text is duplicated via textContent, so any markup inside `inner`
 * is flattened to plain text on wiring.
 */
export function wireMarquee(container, inner) {
    if (!container || !inner) return false;
    if (inner.dataset.wuiMarqueeInit) return false;

    // overflow:hidden is inert on a non-replaced inline box, and such a box
    // reports clientWidth 0 — which would read as "everything overflows" and
    // wire a marquee whose duplicated text then spills across the layout
    // instead of being clipped. Promote it to a box that can actually clip.
    if (getComputedStyle(container).display === 'inline') {
        container.style.display = 'inline-block';
        container.style.verticalAlign = 'bottom';
    }

    // A container with no measurable width tells us nothing: it is hidden, not
    // yet laid out, or zero-sized. Leave it un-wired and re-checkable.
    if (container.clientWidth === 0) return false;

    const textWidth = inner.scrollWidth;
    if (textWidth <= container.clientWidth + 1) return false;

    inner.dataset.wuiMarqueeInit = '1';

    const text  = inner.textContent;
    const shift = textWidth + GAP_PX;

    const copy1  = document.createElement('span');
    copy1.textContent = text;
    const spacer = document.createElement('span');
    spacer.style.cssText = `display:inline-block;width:${GAP_PX}px;flex-shrink:0`;
    const copy2  = document.createElement('span');
    copy2.textContent = text;

    inner.textContent = '';
    inner.append(copy1, spacer, copy2);

    inner.style.setProperty('--marquee-shift', `${-shift}px`);
    inner.style.setProperty('--marquee-dur',   `${Math.max(MIN_DURATION_SEC, shift / SPEED_PX_PER_SEC)}s`);

    container.classList.add('wui-marquee', 'overflows');
    inner.classList.add('wui-marquee-inner');
    return true;
}
