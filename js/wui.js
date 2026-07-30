/* wirezat-ui-v1 / js/wui.js
   wui declarative framework entry point.

   Usage:
     import { init, renderPage, showModal } from '/js/wui.js'

     await init({
       theme: { accent: '#3b82f6' },
       lang:  'en',                          // optional, defaults to stored getLang()
       nav:   [{ href: '/save', icon: '🏭', label: 'Factories' }],
     })

     const page = renderPage({
       containers: [{ id: 'pl-table', title: 'factory.pl.title', content: { type: 'table', columns: [...], rows: [...] } }],
     })
     page.get('pl-table').update({ rows: newRows })

     showModal({ titleKey: '...', content: {...}, actions: [...] })

   A page opts in by including <div id="wui-page-content"></div> in its
   static HTML (same placeholder pattern already used by e.g.
   #factories-container) — renderPage() targets that id unless `host` is given.
   `shell: false` skips requiring the placeholder to exist inside the app
   shell (used by chrome-less pages) — the host lookup still applies.
*/

import { applyAccentTheme }        from './wui/accent-theme.js'
import { init as initHeaderChrome } from './header.js'
import { load as loadI18n, applyI18n, getLang } from './i18n.js'
import { buildContainer }          from './wui/container-builder.js'
import { openWuiModal }            from './wui/modal.js'

export async function init({ theme = {}, lang = null, nav = [] } = {}) {
    applyAccentTheme(theme)
    await loadI18n(lang ?? getLang())
    applyI18n()
    await initHeaderChrome({ navLinks: nav })
}

export function renderPage({ shell = true, host = '#wui-page-content', containers = [] } = {}) {
    const mount = document.querySelector(host)
    if (!mount) {
        throw new Error(`wui.renderPage: no host element found for selector "${host}"`)
    }
    if (!shell) {
        document.querySelector('.header')?.remove()
        document.querySelector('.sidebar')?.remove()
    }

    const handles = new Map()
    for (const cfg of containers) {
        const handle = buildContainer(cfg)
        mount.appendChild(handle.el)
        if (cfg.id) handles.set(cfg.id, handle)
    }

    return {
        get(id) {
            const handle = handles.get(id)
            if (!handle) {
                throw new Error(`wui.renderPage: no container with id "${id}"`)
            }
            return handle
        },
    }
}

export function showModal(cfg) {
    return openWuiModal(cfg)
}
