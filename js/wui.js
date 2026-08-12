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
       pageHeader: { titleKey: 'factory.pl.title', breadcrumb: [...], actions: [...] },
       full: [{ id: 'banner', ... }],        // optional full-width containers, above the split row
       main: [{ id: 'pl-table', title: 'factory.pl.title', content: { type: 'table', columns: [...], rows: [...] } }],
       side: [{ id: 'pl-io', ... }],         // optional; its presence toggles split-layout rendering
     })
     page.get('pl-table').update({ rows: newRows })

     showModal({ preset: 'form', titleKey: '...', content: {...}, actions: [...] })

   A page opts in by including <div id="wui-page-content"></div> in its
   static HTML (same placeholder pattern already used by e.g.
   #factories-container) — renderPage() targets that id unless `host` is given.
   `shell: false` skips requiring the placeholder to exist inside the app
   shell (used by chrome-less pages) — the host lookup still applies.
*/

import { applyAccentTheme }        from './wui/accent-theme.js'
import { init as initHeaderChrome } from './header.js'
import { load as loadI18n, applyI18n, getLang, t } from './i18n.js'
import { buildContainer }          from './wui/container-builder.js'
import { openWuiModal }            from './wui/modal.js'
import { checkThemeTokens }        from './theme-check.js'

export async function init({ theme = {}, lang = null, nav = [] } = {}) {
    applyAccentTheme(theme)
    checkThemeTokens()
    await loadI18n(lang ?? getLang())
    applyI18n()
    await initHeaderChrome({ navLinks: nav })
}

/* renderPage — replaces the old flat containers[] entirely (Schritt 16).
   Linear structure, matches what was actually confirmed visually:
   pageHeader → optional full-width run → one optional split-layout row.
   `side`'s mere presence toggles split-layout rendering; its absence
   collapses to a single-column page (main-panel only, full page width). */
export function renderPage({ shell = true, host = '#wui-page-content',
                              pageHeader = null, full = [], main = [], side = [] } = {}) {
    const mount = document.querySelector(host)
    if (!mount) {
        throw new Error(`wui.renderPage: no host element found for selector "${host}"`)
    }
    if (!shell) {
        document.querySelector('.header')?.remove()
        document.querySelector('.sidebar')?.remove()
    }

    const handles = new Map()
    function mountConfigs(configs, parent) {
        for (const cfg of configs) {
            const handle = buildContainer(cfg)
            parent.appendChild(handle.el)
            if (cfg.id) handles.set(cfg.id, handle)
        }
    }

    if (pageHeader) {
        const headerEl = document.createElement('div')
        headerEl.className = 'page-header'
        headerEl.innerHTML = `
            <div>
                ${pageHeader.breadcrumb ? renderBreadcrumb(pageHeader.breadcrumb) : ''}
                <div class="page-title-row">
                    <div class="page-title">${esc(t(pageHeader.titleKey))}</div>
                </div>
            </div>`
        if (pageHeader.actions?.length) {
            const actionsEl = document.createElement('div')
            actionsEl.className = 'page-header-actions'
            for (const a of pageHeader.actions) {
                const btn = document.createElement('button')
                btn.className = `btn btn-${a.variant || 'ghost'}`
                btn.textContent = t(a.labelKey)
                btn.onclick = a.onClick
                actionsEl.appendChild(btn)
            }
            headerEl.appendChild(actionsEl)
        }
        mount.appendChild(headerEl)
    }

    mountConfigs(full, mount)

    if (main.length || side.length) {
        const splitEl = document.createElement('div')
        splitEl.className = 'split-layout'
        const mainEl = document.createElement('div')
        mainEl.className = 'main-panel'
        mountConfigs(main, mainEl)
        splitEl.appendChild(mainEl)
        if (side.length) {
            const sideEl = document.createElement('div')
            sideEl.className = 'side-panel'
            mountConfigs(side, sideEl)
            splitEl.appendChild(sideEl)
        }
        mount.appendChild(splitEl)
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

function renderBreadcrumb(segments) {
    return `<div class="breadcrumb">${segments.map((s, i) => {
        const isLast = i === segments.length - 1
        const link = isLast
            ? `<span class="breadcrumb-current">${esc(t(s.labelKey))}</span>`
            : `<a href="${esc(s.href)}">${esc(t(s.labelKey))}</a>`
        const dd = (!isLast && s.siblings?.length) ? `<button class="breadcrumb-dd-btn">▾</button>` : ''
        const sep = isLast ? '' : `<span class="breadcrumb-sep">▸</span>`
        return link + dd + sep
    }).join('')}</div>`
}

export function showModal(cfg) {
    return openWuiModal(cfg)
}

/* Escapes for both text and attribute contexts (output lands in href="..."). */
function esc(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
