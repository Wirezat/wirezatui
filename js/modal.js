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
     openModal({ name, title, bodyHTML, confirmLabel, onConfirm })
     closeModal(name)
*/

function _backdrops() {
    return [...document.querySelectorAll('[data-wui-modal]')];
}

// name: optional data-wui-modal value, for pages with more than one generic
// modal-backdrop. Without it, targets the first backdrop in the document
// (backward compatible for single-modal pages).
export function openModal({ name, title = '', bodyHTML = '', confirmLabel = 'Speichern', onConfirm = null } = {}) {
    const backdrop = name
        ? document.querySelector(`[data-wui-modal="${name}"]`)
        : _backdrops()[0];
    if (!backdrop) return;

    backdrop.querySelector('[data-modal-title]').textContent = title;
    backdrop.querySelector('[data-modal-body]').innerHTML   = bodyHTML;

    const confirmBtn = backdrop.querySelector('[data-modal-confirm]');
    if (confirmBtn) {
        confirmBtn.textContent = confirmLabel;
        confirmBtn.onclick = () => { if (onConfirm) onConfirm(); closeModal(name); };
    }

    backdrop.classList.add('open');
    backdrop.querySelector('.modal')?.focus();
}

// name: optional data-wui-modal value. Without it, closes whichever backdrop
// is currently open (backward compatible for single-modal pages).
export function closeModal(name) {
    const backdrop = name
        ? document.querySelector(`[data-wui-modal="${name}"]`)
        : _backdrops().find(b => b.classList.contains('open'));
    backdrop?.classList.remove('open');
}

export function initModal() {
    _backdrops().forEach(backdrop => {
        const name = backdrop.getAttribute('data-wui-modal') || undefined;
        backdrop.addEventListener('click', e => {
            if (e.target === backdrop) closeModal(name);
        });
        backdrop.querySelectorAll('[data-modal-close], [data-modal-cancel]').forEach(el => {
            el.addEventListener('click', () => closeModal(name));
        });
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
    });
}
