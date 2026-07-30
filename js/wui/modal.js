/* wirezat-ui-v1 / js/wui/modal.js
   wui declarative modal: showModal(config) builds title/body/footer from
   data, using the same content-types as containers. Replaces both the
   static data-wui-modal markup path and createModal()'s programmatic path
   with a single mechanism.

   Usage:
     import { openWuiModal, closeWuiModal } from '/js/wui/modal.js'
     openWuiModal({
       titleKey: 'save.mods.manage_title',
       content: { type: 'form', fields: [...] },
       actions: [
         { labelKey: 'common.cancel', variant: 'ghost' },
         { labelKey: 'common.confirm', variant: 'primary', onClick: () => {} },
       ],
     })
*/

import { renderContent } from './content-types/index.js'
import { t } from '../i18n.js'

let _activeBackdrop = null

export function openWuiModal({ titleKey = null, content = null, actions = [] } = {}) {
    closeWuiModal()

    const backdrop = document.createElement('div')
    backdrop.className = 'modal-backdrop'

    const modal = document.createElement('div')
    modal.className = 'modal'

    if (titleKey) {
        const header = document.createElement('div')
        header.className = 'modal-header'

        const titleEl = document.createElement('span')
        titleEl.className = 'modal-title'
        titleEl.textContent = t(titleKey)

        const closeBtn = document.createElement('button')
        closeBtn.className = 'modal-close'
        closeBtn.textContent = '×'
        closeBtn.addEventListener('click', closeWuiModal)

        header.append(titleEl, closeBtn)
        modal.appendChild(header)
    }

    const body = document.createElement('div')
    body.className = 'modal-body'
    if (content) {
        body.appendChild(renderContent(content).el)
    }
    modal.appendChild(body)

    if (actions.length) {
        const footer = document.createElement('div')
        footer.className = 'modal-footer'
        actions.forEach(a => {
            const btn = document.createElement('button')
            btn.className = 'btn btn-sm ' + (
                a.variant === 'primary' ? 'btn-primary'
                : a.variant === 'danger' ? 'btn-danger'
                : 'btn-ghost')
            btn.textContent = t(a.labelKey)
            btn.addEventListener('click', () => {
                a.onClick?.()
                if (a.closeOnClick !== false) closeWuiModal()
            })
            footer.appendChild(btn)
        })
        modal.appendChild(footer)
    }

    backdrop.appendChild(modal)
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeWuiModal() })
    document.body.appendChild(backdrop)
    _activeBackdrop = backdrop

    return { close: closeWuiModal }
}

export function closeWuiModal() {
    _activeBackdrop?.remove()
    _activeBackdrop = null
}
