/* wirezat-ui-v1 / js/components/popover.js
   Floating menu anchored to an arbitrary trigger element's click position —
   the dynamic-positioning counterpart to dropdown.js (which only supports a
   static .dropdown-wrap ancestor). Reuses .dropdown-panel/.dropdown-item
   styling so it looks identical to static dropdowns.

   Usage:
     import { openPopover, closePopover } from '/ui/js/components/popover.js'

     openPopover(triggerEl, [
       { label: 'Change recipe', action: 'change' },
       { label: 'Compressor', subtitle: '← iron_double_ingot', action: 'r1' },
       { label: 'Stop here',  action: 'stop', danger: true },
     ], {
       onSelect: (action) => { ... },
     })
*/

let panel = null
let onOutsideClick = null

export function openPopover(anchorEl, items = [], { onSelect = () => {} } = {}) {
    closePopover()

    panel = document.createElement('div')
    // No '.open' class: dropdown.js's global closeAll() strips '.open' from every
    // '.dropdown-panel.open' on every document click (including the click that
    // opens this very panel, since it bubbles up to document too). This panel's
    // visibility is CSS-unconditional (see .dropdown-panel-floating) — its
    // lifecycle is create-to-show / remove-to-hide, handled entirely below.
    panel.className = 'dropdown-panel dropdown-panel-floating'
    panel.innerHTML = items.map((it, i) => `
        <button type="button" class="dropdown-item${it.danger ? ' danger' : ''}${it.active ? ' active' : ''}" data-idx="${i}">
            <span class="dropdown-item-main">
                <span class="dropdown-item-label">${esc(it.label)}</span>
                ${it.subtitle ? `<span class="dropdown-item-subtitle">${esc(it.subtitle)}</span>` : ''}
            </span>
        </button>
    `).join('')

    panel.addEventListener('click', e => {
        const btn = e.target.closest('[data-idx]')
        if (!btn) return
        const item = items[Number(btn.dataset.idx)]
        closePopover()
        onSelect(item.action, item)
    })

    document.body.appendChild(panel)

    const r = anchorEl.getBoundingClientRect()
    panel.style.top   = (r.bottom + 4) + 'px'
    panel.style.right = (window.innerWidth - r.right) + 'px'

    // Defer so the click that opened the popover doesn't immediately close it.
    onOutsideClick = e => { if (!e.target.closest('.dropdown-panel-floating')) closePopover() }
    setTimeout(() => document.addEventListener('click', onOutsideClick), 0)
    document.addEventListener('keydown', escClose)

    return panel
}

export function closePopover() {
    if (panel) { panel.remove(); panel = null }
    if (onOutsideClick) { document.removeEventListener('click', onOutsideClick); onOutsideClick = null }
    document.removeEventListener('keydown', escClose)
}

function escClose(e) { if (e.key === 'Escape') closePopover() }

function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
