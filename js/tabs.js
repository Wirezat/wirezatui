/* wirezat-ui-v1 / js/tabs.js
   Tab switching for .tabs-bar / .tab-btn / [data-tab-panel].
   Usage:
     initTabs(containerEl)        — scoped to a parent element
     initTabs()                   — initialises all .tabs-bar on the page
*/

export function initTabs(scope = document) {
    scope.querySelectorAll('.tabs-bar').forEach(bar => {
        bar.addEventListener('click', e => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            const key = btn.dataset.tab;
            if (!key) return;

            // Deactivate all tabs in this bar
            bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Find panels (scoped to nearest common ancestor with [data-tab-panel])
            const panelRoot = bar.closest('[data-tabs]') ?? bar.parentElement;
            panelRoot.querySelectorAll('[data-tab-panel]').forEach(p => {
                p.hidden = p.dataset.tabPanel !== key;
            });
        });
    });
}
