/* wirezat-ui-v1 / js/tabs.js
   Tab switching for .wui-tabs / .wui-tab / [data-tab-panel].
   Usage:
     initTabs(containerEl)        — scoped to a parent element
     initTabs()                   — initialises all .wui-tabs on the page
*/

export function initTabs(scope = document) {
    scope.querySelectorAll('.wui-tabs').forEach(bar => {
        bar.addEventListener('click', e => {
            const btn = e.target.closest('.wui-tab')
            if (!btn) return
            const key = btn.dataset.tab
            if (!key) return

            bar.querySelectorAll('.wui-tab').forEach(b => b.classList.remove('active'))
            btn.classList.add('active')

            const panelRoot = bar.closest('[data-tabs]') ?? bar.parentElement
            panelRoot.querySelectorAll('[data-tab-panel]').forEach(p => {
                p.hidden = p.dataset.tabPanel !== key
            })
        })
    })
}
