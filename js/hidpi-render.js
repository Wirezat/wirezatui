/* wirezat-ui-v1 / js/hidpi-render.js
   Upgrades on-demand rendered textures (src containing "/assets/render/") to
   a devicePixelRatio-appropriate size instead of the backend's flat default.

   initHiDPIRender(scope?)
     Wires every img[data-hidpi-px] within scope (default: document): reads
     that attribute as the CSS pixel size, multiplies by devicePixelRatio,
     and rewrites the img's src (and any data-wui-cycle frames) to that exact
     device pixel count. Explicit rather than measured off the element's own
     box, since callers are often still detached or hidden when this runs.
     Call before initIconCycle on the same element — it caches
     data-wui-cycle's frames once at wiring time. Safe to call repeatedly;
     already-wired images are skipped.

   Falls back to the old coarse bucket sizes if the backend rejects an exact
   size (a stale deployment); sticky for the rest of the page once triggered.
   MIN/MAX_SIZE mirror internal/api/render.go's own bounds.
*/

const MIN_SIZE = 8;
const MAX_SIZE = 256;
const COARSE_SIZES = [16, 32, 64, 128];

// Sticky for the page's lifetime once set: no point re-attempting the exact
// path elsewhere once one request has shown the backend won't serve it.
let exactSizeUnsupported = false;

function targetPx(cssPx) {
    return Math.ceil(cssPx * (window.devicePixelRatio || 1));
}

function coarseSize(cssPx) {
    const target = targetPx(cssPx);
    return COARSE_SIZES.find(s => s >= target) ?? COARSE_SIZES[COARSE_SIZES.length - 1];
}

function exactSize(cssPx) {
    return Math.min(Math.max(targetPx(cssPx), MIN_SIZE), MAX_SIZE);
}

function sizeFor(cssPx) {
    return exactSizeUnsupported ? coarseSize(cssPx) : exactSize(cssPx);
}

function isRenderURL(url) {
    return !!url && url.includes('/assets/render/');
}

function withSize(url, size) {
    if (!isRenderURL(url)) return url;
    return `${url.split('?')[0]}?size=${size}`;
}

export function initHiDPIRender(scope = document) {
    scope.querySelectorAll('img[data-hidpi-px]').forEach(img => {
        if (img.dataset.wuiHidpiWired) return;
        img.dataset.wuiHidpiWired = '1';

        const cssPx  = parseFloat(img.dataset.hidpiPx) || 32;
        const rawSrc = img.getAttribute('src');

        if (isRenderURL(rawSrc)) {
            const triedExact = !exactSizeUnsupported;
            img.src = withSize(rawSrc, sizeFor(cssPx));
            if (triedExact) {
                img.addEventListener('error', function onErr() {
                    img.removeEventListener('error', onErr);
                    exactSizeUnsupported = true;
                    img.src = withSize(rawSrc, coarseSize(cssPx));
                }, { once: true });
            }
        }

        if (!img.dataset.wuiCycle) return;
        try {
            const frames = JSON.parse(img.dataset.wuiCycle);
            if (!Array.isArray(frames)) return;
            const size = sizeFor(cssPx);
            img.dataset.wuiCycle = JSON.stringify(
                frames.map(f => (f && typeof f.src === 'string' && isRenderURL(f.src))
                    ? { ...f, src: withSize(f.src, size) }
                    : f)
            );
        } catch {
            // Malformed list: leave as authored, same guard icon-cycle.js itself uses.
        }
    });
}
