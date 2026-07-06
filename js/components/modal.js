/* wirezat-ui-v1 / js/components/modal.js
   Factory: creates and mounts the global modal DOM once.
   Behavior wired automatically on creation.

   Usage:
     import { createModal, openModal, closeModal } from '/ui/js/components/modal.js'
     createModal({ cancelLabel: 'Abbrechen', confirmLabel: 'Speichern' })
     openModal({ title: 'Neue Welt', bodyHTML: '<p>…</p>', onConfirm: () => save() })
*/

import { initModal, openModal, closeModal } from '../modal.js'

export { openModal, closeModal }

export function createModal({ cancelLabel = 'Abbrechen', confirmLabel = 'Speichern' } = {}) {
    if (document.querySelector('[data-wui-modal]')) return document.querySelector('[data-wui-modal]')

    const el = document.createElement('div')
    el.className = 'modal-backdrop'
    el.setAttribute('data-wui-modal', '')
    el.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="wui-modal-title">
            <div class="modal-header">
                <span class="modal-title" data-modal-title id="wui-modal-title"></span>
                <button class="btn btn-icon btn-sm btn-ghost modal-close" data-modal-close>✕</button>
            </div>
            <div class="modal-body" data-modal-body></div>
            <div class="modal-footer">
                <button class="btn btn-ghost" data-modal-cancel>${cancelLabel}</button>
                <button class="btn btn-primary" data-modal-confirm>${confirmLabel}</button>
            </div>
        </div>`

    document.body.appendChild(el)
    initModal()
    return el
}
