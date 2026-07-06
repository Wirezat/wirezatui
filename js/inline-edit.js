/* wirezat-ui-v1 / js/inline-edit.js
   Inline-editing for .field-editable elements.
   Click activates; blur or Enter confirms; Escape cancels.

   Usage:
     initInlineEdit(scope?)    — scope defaults to document
     or add [data-inline-edit] to a container for auto-init
*/

export function initInlineEdit(scope = document) {
    scope.querySelectorAll('.field-editable[contenteditable], .field-editable[data-inline]').forEach(el => {
        attachInlineEdit(el);
    });
}

export function attachInlineEdit(el) {
    if (el.dataset.inlineReady) return;
    el.dataset.inlineReady = '1';

    let original = '';

    el.addEventListener('click', () => {
        if (el.classList.contains('editing')) return;
        original = el.textContent;
        el.contentEditable = 'true';
        el.classList.add('editing');
        el.focus();

        // Place cursor at end
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(range);
    });

    el.addEventListener('blur', () => commit(el));

    el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(el); }
        if (e.key === 'Escape') { cancel(el, original); }
    });
}

function commit(el) {
    if (!el.classList.contains('editing')) return;
    el.contentEditable = 'false';
    el.classList.remove('editing');
    el.dispatchEvent(new CustomEvent('inline-commit', { bubbles: true, detail: { value: el.textContent } }));
}

function cancel(el, original) {
    el.textContent = original;
    el.contentEditable = 'false';
    el.classList.remove('editing');
    el.dispatchEvent(new CustomEvent('inline-cancel', { bubbles: true }));
}
