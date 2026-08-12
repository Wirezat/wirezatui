/* wirezat-ui-v1 / js/wui/modal.js
   wui declarative modal: showModal(cfg) builds one Modal-Chrome and dispatches
   its body/footer by cfg.preset. All presets (confirm, danger-confirm, prompt,
   form, checklist, popconfirm, wizard) are configurations of the same chrome,
   not separate components.

   Every preset returns a handle { el, close(), values() }. values() always
   yields a plain object: form/prompt key it by field key, checklist by each
   item's `id` (falling back to its index) with a boolean checked state,
   confirm/danger-confirm/wizard/popconfirm have no inputs and yield {}.

   Usage:
     import { openWuiModal, closeWuiModal } from '/js/wui/modal.js'
     openWuiModal({
       preset: 'confirm',
       titleKey: 'save.delete_title',
       messageKey: 'save.delete_question',
       actions: [
         { labelKey: 'common.cancel', variant: 'ghost' },
         { labelKey: 'common.delete', variant: 'danger', onClick: () => {} },
       ],
     })
*/

import { renderContent } from './content-types/index.js'
import { render as renderForm } from './content-types/form.js'
import { buildContainer } from './container-builder.js'
import { t } from '../i18n.js'

let _activeRoot = null
let _onOutsideClick = null

/* Preset defaults — each preset is a Modal-Chrome configuration, not a
   separate component (Schritt 7). draggable defaults true except for
   popconfirm (transient, trigger-bound) and toast/alert (handled by
   their own modules, never routed through showModal). */
const PRESET_DEFAULTS = {
    'confirm':         { draggable: true },
    'danger-confirm':  { draggable: true },
    'prompt':          { draggable: true },
    'form':            { draggable: true },
    'checklist':       { draggable: true },
    'popconfirm':      { draggable: false, backdrop: false },
    'wizard':          { draggable: true },
}

export function openWuiModal(cfg) {
    const defaults = PRESET_DEFAULTS[cfg?.preset]
    if (!defaults) throw new Error(`wui.showModal: unknown preset "${cfg?.preset}"`)
    const merged = { ...defaults, ...cfg }
    return buildModal(merged)
}

export function closeWuiModal() {
    _activeRoot?.remove()
    _activeRoot = null
    if (_onOutsideClick) {
        document.removeEventListener('click', _onOutsideClick)
        _onOutsideClick = null
    }
    document.removeEventListener('keydown', _escClose)
}

function _escClose(e) { if (e.key === 'Escape') closeWuiModal() }

/* ── Chrome ──────────────────────────────────────────────────────────────── */

function buildModal(cfg) {
    closeWuiModal()

    if (cfg.preset === 'popconfirm') return _buildPopconfirm(cfg)

    const card = document.createElement('div')
    card.className = 'modal-card'

    const header = _buildHeader(cfg)
    if (header) card.appendChild(header)

    const body = document.createElement('div')
    body.className = 'modal-body'
    card.appendChild(body)

    const footer = document.createElement('div')
    footer.className = 'modal-footer'
    card.appendChild(footer)

    const handle = { el: card, close: closeWuiModal, values: () => ({}) }

    if (cfg.preset === 'wizard') {
        _mountWizard(cfg, { header, body, footer, handle })
    } else {
        const source = _buildBody(cfg, body)
        if (source?.values) handle.values = source.values
        _fillFooter(footer, cfg, handle)
    }

    if (cfg.draggable && header) _makeDraggable(card, header)

    let root = card
    if (cfg.backdrop !== false) {
        const backdrop = document.createElement('div')
        backdrop.className = 'modal-backdrop'
        backdrop.appendChild(card)
        backdrop.addEventListener('click', e => { if (e.target === backdrop) closeWuiModal() })
        root = backdrop
    }

    document.body.appendChild(root)
    _activeRoot = root
    document.addEventListener('keydown', _escClose)

    return handle
}

function _buildHeader(cfg) {
    if (!cfg.titleKey && cfg.preset !== 'wizard') return null

    const header = document.createElement('div')
    header.className = 'modal-header'
    if (cfg.draggable) header.setAttribute('data-draggable', '')

    const titleEl = document.createElement('span')
    titleEl.className = 'modal-title'
    titleEl.textContent = cfg.titleKey ? t(cfg.titleKey) : ''
    header.appendChild(titleEl)

    const right = document.createElement('span')
    right.className = 'modal-header-right'

    if (cfg.preset === 'wizard') {
        const count = document.createElement('span')
        count.className = 'modal-step-count'
        right.appendChild(count)
    }

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'modal-close'
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', closeWuiModal)
    right.appendChild(closeBtn)

    header.appendChild(right)
    return header
}

/* Body per preset. Returns the rendered source handle (may expose values()). */
function _buildBody(cfg, body) {
    if (cfg.preset === 'confirm' || cfg.preset === 'danger-confirm') {
        const msg = document.createElement('div')
        msg.className = 'modal-message'
        msg.textContent = cfg.messageKey ? t(cfg.messageKey) : ''
        body.appendChild(msg)
        return null
    }

    if (cfg.preset === 'prompt') {
        const form = renderForm({
            fields: [{ type: 'text', key: 'value', labelKey: cfg.fieldLabelKey, value: cfg.value ?? '' }],
        })
        body.appendChild(form.el)
        return form
    }

    if (cfg.preset === 'form') {
        const rendered = renderContent(cfg.content)
        body.appendChild(rendered.el)
        return rendered
    }

    if (cfg.preset === 'checklist') {
        return _buildChecklist(cfg, body)
    }

    if (cfg.content) {
        const rendered = renderContent(cfg.content)
        body.appendChild(rendered.el)
        return rendered
    }
    return null
}

function _buildChecklist(cfg, body) {
    const items = cfg.items ?? []
    const boxes = []

    if (cfg.selectAll) {
        const allRow = document.createElement('label')
        allRow.className = 'check-item check-item-all'
        const allBox = document.createElement('input')
        allBox.type = 'checkbox'
        allBox.checked = items.length > 0 && items.every(i => i.checked)
        allBox.addEventListener('change', () => {
            boxes.forEach(b => { b.checked = allBox.checked })
        })
        allRow.appendChild(allBox)
        allRow.appendChild(document.createTextNode(t('common.select_all')))
        body.appendChild(allRow)
    }

    items.forEach(item => {
        const row = document.createElement('label')
        row.className = 'check-item'
        const box = document.createElement('input')
        box.type = 'checkbox'
        box.checked = !!item.checked
        boxes.push(box)
        row.appendChild(box)
        row.appendChild(document.createTextNode(t(item.labelKey)))
        body.appendChild(row)
    })

    return {
        values: () => Object.fromEntries(items.map((item, i) => [item.id ?? i, boxes[i].checked])),
    }
}

/* Footer: cfg.actions for every preset except prompt, whose confirm button has
   the fixed onConfirm(value) signature. */
function _fillFooter(footer, cfg, handle) {
    footer.innerHTML = ''

    if (cfg.preset === 'prompt') {
        footer.appendChild(_actionButton(
            { labelKey: cfg.cancelLabelKey ?? 'common.cancel', variant: 'ghost' }, handle))
        footer.appendChild(_actionButton({
            labelKey: cfg.confirmLabelKey ?? 'common.confirm',
            variant: 'primary',
            onClick: () => cfg.onConfirm?.(handle.values().value),
        }, handle))
        return
    }

    ;(cfg.actions ?? []).forEach(a => footer.appendChild(_actionButton(a, handle)))
}

function _actionButton(a, handle) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'btn btn-sm ' + (
        a.variant === 'primary' ? 'btn-primary'
        : a.variant === 'danger' ? 'btn-danger'
        : 'btn-ghost')
    btn.textContent = t(a.labelKey)
    btn.addEventListener('click', () => {
        a.onClick?.(handle.values())
        if (a.closeOnClick !== false) closeWuiModal()
    })
    return btn
}

/* ── Wizard ──────────────────────────────────────────────────────────────── */

function _mountWizard(cfg, { header, body, footer, handle }) {
    const steps = cfg.steps ?? []
    let current = 0

    function renderStep() {
        const step = steps[current]

        const titleEl = header.querySelector('.modal-title')
        if (titleEl) titleEl.textContent = t(step?.titleKey ?? cfg.titleKey ?? '')
        const count = header.querySelector('.modal-step-count')
        if (count) count.textContent = `${current + 1} / ${steps.length}`

        body.innerHTML = ''
        if (cfg.breadcrumb) {
            const crumb = document.createElement('div')
            crumb.className = 'modal-breadcrumb'
            crumb.textContent = steps.map(s => t(s.titleKey)).join(' › ')
            body.appendChild(crumb)
        }
        ;(step?.blocks ?? []).forEach(block => body.appendChild(buildContainer(block).el))

        footer.innerHTML = ''
        const cancel = _actionButton(
            { labelKey: cfg.cancelLabelKey ?? 'common.cancel', variant: 'ghost' }, handle)
        cancel.classList.add('modal-footer-spacer')
        footer.appendChild(cancel)

        if (current > 0) {
            footer.appendChild(_actionButton({
                labelKey: cfg.backLabelKey ?? 'common.back',
                variant: 'ghost',
                closeOnClick: false,
                onClick: () => { current--; renderStep() },
            }, handle))
        }

        const isLast = current === steps.length - 1
        footer.appendChild(_actionButton(isLast
            ? {
                labelKey: cfg.confirmLabelKey ?? 'common.confirm',
                variant: 'primary',
                onClick: () => cfg.onConfirm?.(current),
            }
            : {
                labelKey: cfg.nextLabelKey ?? 'common.next',
                variant: 'primary',
                closeOnClick: false,
                onClick: () => { current++; renderStep() },
            }, handle))
    }

    handle.step = () => current
    renderStep()
}

/* ── Popconfirm ──────────────────────────────────────────────────────────── */

/* Anchored, backdrop-less confirm card. Positioning mirrors popover.js:
   the anchor's client rect pins a fixed-position panel below/right-aligned. */
function _buildPopconfirm(cfg) {
    const card = document.createElement('div')
    card.className = 'popconfirm-card'

    if (cfg.messageKey) {
        const msg = document.createElement('div')
        msg.className = 'modal-message'
        msg.textContent = t(cfg.messageKey)
        card.appendChild(msg)
    }

    const handle = { el: card, close: closeWuiModal, values: () => ({}) }

    const footer = document.createElement('div')
    footer.className = 'modal-footer'
    ;(cfg.actions ?? []).forEach(a => footer.appendChild(_actionButton(a, handle)))
    card.appendChild(footer)

    document.body.appendChild(card)
    _activeRoot = card

    const r = cfg.anchorEl.getBoundingClientRect()
    card.style.top   = (r.bottom + 4) + 'px'
    card.style.right = (window.innerWidth - r.right) + 'px'

    // Defer so the click that opened the popconfirm doesn't immediately close it.
    _onOutsideClick = e => { if (!e.target.closest('.popconfirm-card')) closeWuiModal() }
    setTimeout(() => document.addEventListener('click', _onOutsideClick), 0)
    document.addEventListener('keydown', _escClose)

    return handle
}

/* ── Drag ────────────────────────────────────────────────────────────────── */

/* Press-and-move on the header translates the card. Same pointer pattern as
   the graph canvas's drag-pan, incl. the 4px threshold that keeps plain
   clicks (e.g. the close button) working as clicks. */
function _makeDraggable(card, header) {
    let drag = null
    let offX = 0, offY = 0

    header.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return
        drag = { x: e.clientX, y: e.clientY, ox: offX, oy: offY, moved: false }
        header.setPointerCapture(e.pointerId)
    })
    header.addEventListener('pointermove', e => {
        if (!drag) return
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
        if (drag.moved) {
            offX = drag.ox + dx
            offY = drag.oy + dy
            card.style.transform = `translate(${offX}px, ${offY}px)`
        }
    })
    const endDrag = () => { drag = null }
    header.addEventListener('pointerup', endDrag)
    header.addEventListener('pointercancel', endDrag)
}
