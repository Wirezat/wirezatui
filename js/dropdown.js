/* wirezat-ui-v1 / js/dropdown.js
   Generic dropdown: toggle .open on panel, close on outside click / Escape.

   Expected HTML:
     <div class="dropdown-wrap">
       <button data-dropdown-trigger>…</button>
       <div class="dropdown-panel" id="some-panel">…</div>
     </div>

   Usage:
     initDropdowns(scope?)   — auto-wires all [data-dropdown-trigger] in scope
*/

export function initDropdowns(scope = document) {
    scope.querySelectorAll('[data-dropdown-trigger]').forEach(trigger => {
        const wrap  = trigger.closest('.dropdown-wrap');
        const panel = wrap?.querySelector('.dropdown-panel');
        if (!panel) return;

        trigger.addEventListener('click', e => {
            e.stopPropagation();
            const open = panel.classList.contains('open');
            closeAll();
            if (!open) panel.classList.add('open');
        });
    });

    document.addEventListener('click', closeAll);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
}

function closeAll() {
    document.querySelectorAll('.dropdown-panel.open').forEach(p => p.classList.remove('open'));
}
