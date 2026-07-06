/* wirezat-ui-v1 / js/modal.js
   Global modal: activated by containers, not placed per-page.

   HTML structure expected:
     <div class="modal-backdrop" data-wui-modal>
       <div class="modal" role="dialog" aria-modal="true" aria-labelledby="wui-modal-title">
         <div class="modal-header">
           <span class="modal-title" data-modal-title id="wui-modal-title"></span>
           <button class="modal-close" data-modal-close>✕</button>
         </div>
         <div class="modal-body" data-modal-body></div>
         <div class="modal-footer">
           <button class="btn btn-ghost" data-modal-cancel>Abbrechen</button>
           <button class="btn btn-primary" data-modal-confirm></button>
         </div>
       </div>
     </div>

   Usage:
     openModal({ title, bodyHTML, confirmLabel, onConfirm })
     closeModal()
*/

function _backdrop() {
    return document.querySelector('[data-wui-modal]');
}

export function openModal({ title = '', bodyHTML = '', confirmLabel = 'Speichern', onConfirm = null } = {}) {
    const backdrop = _backdrop();
    if (!backdrop) return;

    backdrop.querySelector('[data-modal-title]').textContent = title;
    backdrop.querySelector('[data-modal-body]').innerHTML   = bodyHTML;

    const confirmBtn = backdrop.querySelector('[data-modal-confirm]');
    if (confirmBtn) {
        confirmBtn.textContent = confirmLabel;
        confirmBtn.onclick = () => { if (onConfirm) onConfirm(); closeModal(); };
    }

    backdrop.classList.add('open');
    backdrop.querySelector('.modal')?.focus();
}

export function closeModal() {
    _backdrop()?.classList.remove('open');
}

export function initModal() {
    const backdrop = _backdrop();
    if (!backdrop) return;

    backdrop.addEventListener('click', e => {
        if (e.target === backdrop) closeModal();
    });

    backdrop.querySelectorAll('[data-modal-close], [data-modal-cancel]').forEach(el => {
        el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
    });
}
