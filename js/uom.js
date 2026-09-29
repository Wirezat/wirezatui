/* wirezat-ui-v1 / js/uom.js
   Unit-of-measure badge: a value shown in the viewer's chosen unit. Hover lists it in every
   unit, and clicking a row there makes that unit the choice; a click on the badge keeps the
   list open. Choices persist per system in localStorage and apply page-wide.

   defineUom(name, { base, default?, units: [{ id, label, factor: { num, den } }] })
     factor is the unit's size in base units (1 min = 60 s, 1 t = 1/20 s); default is the
     unit shown until the viewer picks one, the base unit when omitted.
   initUom()  — render every .wui-uom now and whenever one is added later; call once.
   uomHTML({ value, uom?, unit?, per?, perUnit?, cls? }) — the same badge, already rendered.

   <span class="wui-uom" data-uom="volume" data-uom-unit="mb"
         data-uom-per="time" data-uom-per-unit="s" data-uom-value="250"></span>
     data-uom / data-uom-per are each optional, one is required. data-uom-value is
     "a", "a.b" or "a/b" and is given in data-uom-unit per data-uom-per-unit. A badge with
     both systems lists its units as a matrix.
*/

const KEY = name => `wui-uom:${name}`;
const DECIMALS = 4;
const SHOW_DELAY = 120;
const HIDE_DELAY = 80;

const _systems = new Map();
let _pop = null;
let _showTimer = null;
let _hideTimer = null;
let _started = false;

export function defineUom(name, { base, default: fallback = base, units }) {
    const byID = new Map(units.map(u => [u.id, u]));
    for (const id of [base, fallback]) {
        if (!byID.has(id)) throw new Error(`defineUom ${name}: unit ${id} is not among its units`);
    }
    _systems.set(name, { name, base, fallback, units, byID });
    if (_started) renderAll(document);
}

export function getUomUnit(name) {
    const sys = _systems.get(name);
    if (!sys) return null;
    let stored = null;
    try { stored = localStorage.getItem(KEY(name)); } catch {}
    return sys.byID.has(stored) ? stored : sys.fallback;
}

export function setUomUnit(name, unitID) {
    const sys = _systems.get(name);
    if (!sys?.byID.has(unitID)) return;
    try { localStorage.setItem(KEY(name), unitID); } catch {}
    renderAll(document);
    document.dispatchEvent(new CustomEvent('wui-uom-change', { detail: { name, unit: unitID } }));
}

export function initUom() {
    if (_started) return;
    _started = true;
    renderAll(document);
    new MutationObserver(muts => {
        for (const m of muts) {
            for (const n of m.addedNodes) {
                if (n.nodeType !== 1 || n.closest?.('.wui-uom-pop')) continue;
                if (n.matches('.wui-uom')) render(n);
                n.querySelectorAll?.('.wui-uom').forEach(render);
            }
        }
    }).observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener('mouseover', e => {
        const badge = e.target.closest?.('.wui-uom');
        if (badge) scheduleShow(badge);
        else if (e.target.closest?.('.wui-uom-pop')) clearTimeout(_hideTimer);
    });
    document.addEventListener('mouseout', e => {
        const from = e.target.closest?.('.wui-uom, .wui-uom-pop');
        const to = e.relatedTarget?.closest?.('.wui-uom, .wui-uom-pop');
        if (from && !to && _pop?.mode !== 'pinned') scheduleHide();
    });
    document.addEventListener('click', e => {
        const badge = e.target.closest('.wui-uom');
        if (badge) {
            e.preventDefault();
            e.stopPropagation();
            if (_pop?.mode === 'pinned' && _pop.badge === badge) close();
            else open(badge, 'pinned');
            return;
        }
        const cell = e.target.closest('.wui-uom-pop [data-uom-cell]');
        if (cell) {
            e.stopPropagation();
            const spec = badgeSpec(_pop.badge);
            setUomUnit(spec.num.name, cell.dataset.uomNum);
            setUomUnit(spec.per.name, cell.dataset.uomPer);
            if (_pop) open(_pop.badge, _pop.mode);
            return;
        }
        const opt = e.target.closest('.wui-uom-pop [data-uom-pick]');
        if (opt) {
            e.stopPropagation();
            setUomUnit(opt.dataset.uomSystem, opt.dataset.uomPick);
            if (_pop) open(_pop.badge, _pop.mode);
            return;
        }
        if (!e.target.closest('.wui-uom-pop')) close();
    }, true);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') close();
        const badge = e.target.closest?.('.wui-uom');
        if (badge && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            open(badge, 'pinned');
        }
    });
    window.addEventListener('scroll', () => close(), true);
    window.addEventListener('resize', () => close());
}

function renderAll(scope) {
    scope.querySelectorAll('.wui-uom').forEach(render);
}

export function uomHTML({ value, uom = '', unit = '', per = '', perUnit = '', cls = '' }) {
    const attrs = { uom, 'uom-unit': unit, 'uom-per': per, 'uom-per-unit': perUnit, 'uom-value': value };
    const data = Object.entries(attrs).filter(([, v]) => v !== '' && v != null)
        .map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
    const spec = specOf({ value, uom, unit, per, perUnit });
    const inner = spec ? innerHTML(spec) : '';
    return `<span class="wui-uom${cls ? ' ' + esc(cls) : ''}"${data} tabindex="0" role="button">${inner}</span>`;
}

function specOf({ value, uom, unit, per, perUnit }) {
    const v = parseRational(value);
    const num = uom ? _systems.get(uom) : null;
    const den = per ? _systems.get(per) : null;
    if (!v || (!num && !den)) return null;
    if (num && !num.byID.has(unit)) return null;
    if (den && !den.byID.has(perUnit)) return null;
    return { value: v, num, per: den, numUnit: unit, perUnit };
}

function badgeSpec(el) {
    const d = el.dataset;
    return specOf({ value: d.uomValue, uom: d.uom, unit: d.uomUnit, per: d.uomPer, perUnit: d.uomPerUnit });
}

function innerHTML(spec) {
    const numTo = spec.num ? getUomUnit(spec.num.name) : null;
    const perTo = spec.per ? getUomUnit(spec.per.name) : null;
    return `<span class="wui-uom-value">${esc(formatIn(spec, numTo, perTo))}</span>` +
        `<span class="wui-uom-unit">${esc(unitLabel(spec, numTo, perTo))}</span>`;
}

function render(el) {
    const spec = badgeSpec(el);
    if (!spec) return;
    const html = innerHTML(spec);
    if (el.innerHTML !== html) el.innerHTML = html;
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    el.setAttribute('role', 'button');
}

function convert(spec, numTo, perTo) {
    let [n, d] = spec.value;
    if (spec.num) {
        const from = spec.num.byID.get(spec.numUnit).factor, to = spec.num.byID.get(numTo).factor;
        n *= from.num * to.den;
        d *= from.den * to.num;
    }
    if (spec.per) {
        const from = spec.per.byID.get(spec.perUnit).factor, to = spec.per.byID.get(perTo).factor;
        n *= from.den * to.num;
        d *= from.num * to.den;
    }
    return [n, d];
}

function formatIn(spec, numTo, perTo) {
    const [n, d] = convert(spec, numTo, perTo);
    const r = Math.round((n / d) * 10 ** DECIMALS) / 10 ** DECIMALS;
    return Number.isInteger(r) ? String(r) : r.toFixed(DECIMALS).replace(/\.?0+$/, '');
}

function unitLabel(spec, numTo, perTo) {
    const num = spec.num ? spec.num.byID.get(numTo).label : '';
    return spec.per ? `${num}/${spec.per.byID.get(perTo).label}` : num;
}

function scheduleShow(badge) {
    clearTimeout(_hideTimer);
    if (_pop?.badge === badge) return;
    if (_pop?.mode === 'pinned') return;
    clearTimeout(_showTimer);
    _showTimer = setTimeout(() => open(badge, 'hover'), SHOW_DELAY);
}

function scheduleHide() {
    clearTimeout(_showTimer);
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(close, HIDE_DELAY);
}

function open(badge, mode) {
    clearTimeout(_showTimer);
    clearTimeout(_hideTimer);
    const spec = badgeSpec(badge);
    if (!spec) return;
    if (_pop && _pop.badge !== badge) close();
    const el = _pop?.el ?? document.body.appendChild(document.createElement('div'));
    el.className = 'wui-uom-pop';
    const numTo = spec.num ? getUomUnit(spec.num.name) : null;
    const perTo = spec.per ? getUomUnit(spec.per.name) : null;
    if (spec.num && spec.per) el.innerHTML = matrix(spec, numTo, perTo);
    else if (spec.num) el.innerHTML = section(spec, spec.num, numTo, u => [u, null]);
    else el.innerHTML = section(spec, spec.per, perTo, u => [null, u]);
    place(el, badge);
    _pop = { el, badge, mode };
    badge.classList.add('wui-uom-open');
}

function section(spec, sys, active, pair) {
    return sys.units.map(u => {
        const [nt, pt] = pair(u.id);
        const cls = `wui-uom-row${u.id === active ? ' active' : ''}`;
        const inner = `<span class="wui-uom-row-val">${esc(formatIn(spec, nt, pt))}</span>` +
            `<span class="wui-uom-row-unit">${esc(unitLabel(spec, nt, pt))}</span>`;
        return `<button type="button" class="${cls}" data-uom-system="${esc(sys.name)}" data-uom-pick="${esc(u.id)}">${inner}</button>`;
    }).join('');
}

function matrix(spec, numTo, perTo) {
    const head = spec.per.units.map(pu =>
        `<th class="${pu.id === perTo ? 'active' : ''}">/${esc(pu.label)}</th>`).join('');
    const rows = spec.num.units.map(nu => {
        const cells = spec.per.units.map(pu => {
            const cls = [nu.id === numTo && 'in-row', pu.id === perTo && 'in-col',
                nu.id === numTo && pu.id === perTo && 'active'].filter(Boolean).join(' ');
            return `<td class="${cls}"><button type="button" class="wui-uom-cell" data-uom-cell` +
                ` data-uom-num="${esc(nu.id)}" data-uom-per="${esc(pu.id)}">${esc(formatIn(spec, nu.id, pu.id))}</button></td>`;
        }).join('');
        return `<tr><th class="${nu.id === numTo ? 'active' : ''}">${esc(nu.label)}</th>${cells}</tr>`;
    }).join('');
    return `<table class="wui-uom-grid"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function place(el, badge) {
    const r = badge.getBoundingClientRect();
    const h = el.offsetHeight, w = el.offsetWidth;
    const below = r.bottom + h + 8 <= window.innerHeight;
    el.style.top = `${below ? r.bottom + 4 : Math.max(4, r.top - h - 4)}px`;
    el.style.left = `${Math.min(Math.max(4, r.left), window.innerWidth - w - 4)}px`;
}

function close() {
    clearTimeout(_showTimer);
    if (!_pop) return;
    _pop.badge.classList.remove('wui-uom-open');
    _pop.el.remove();
    _pop = null;
}

function parseRational(s) {
    if (s == null || s === '') return null;
    const str = String(s).trim();
    if (str.includes('/')) {
        const [a, b] = str.split('/').map(Number);
        return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? [a, b] : null;
    }
    const v = Number(str);
    if (!Number.isFinite(v)) return null;
    const dec = (str.split('.')[1] || '').length;
    const den = 10 ** dec;
    return [Math.round(v * den), den];
}

function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
