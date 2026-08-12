/* wirezat-ui-v1 / js/components/container.js
   Factory: creates a data container with header, optional filter bar, and body.

   Usage:
     import { createContainer } from '/ui/js/components/container.js'

     const c = createContainer({
       title:       'Welten',
       views:       [                    // >1 → segmented row of icon buttons
         { key: 'tiles', icon: '▦', label: 'Kacheln' },
         { key: 'table', icon: '☰', label: 'Liste' },
       ],
       view:         'tiles',            // initial active key; falls back to views[0].key
       storageKey:   'view:my-list',      // optional — persists the active key in localStorage
       config:       true,               // adds container-config class (purple tint)
       filters:      [                   // optional filter controls
         { type: 'select', options: ['Alle', 'Aktiv'], placeholder: 'Status' },
         { type: 'search', placeholder: 'Suche…' }
       ],
       flush:        true,               // container-body-flush (for tables)
       onViewChange: (key) => {},
     })
     parentEl.appendChild(c.el)
     c.activeView   // currently active key
     // Update body content:
     c.setContent('<p>…</p>')
     c.setContent(domElement)

   A single view (views.length <= 1) renders as a plain, non-interactive
   label instead of a picker — nothing to switch between.
*/

export function createContainer({
    title        = '',
    view         = null,
    views        = [],
    storageKey   = null,
    config       = false,
    filters      = [],
    flush        = false,
    onViewChange = null,
} = {}) {
    const el = document.createElement('div')
    el.className = 'container' + (config ? ' container-config' : '')

    // ── Header ────────────────────────────────────────────────────────────
    const header = document.createElement('div')
    header.className = 'container-header'

    const titleEl = document.createElement('span')
    titleEl.className = 'container-title'
    titleEl.textContent = title
    header.appendChild(titleEl)

    // View picker — segmented row of icon buttons, one per view.
    const stored = storageKey ? localStorage.getItem(storageKey) : null
    let activeView = (stored && views.some(v => v.key === stored)) ? stored : (view ?? views[0]?.key ?? null)

    if (views.length > 1) {
        const picker = document.createElement('div')
        picker.className = 'view-picker'
        const buttons = new Map()

        for (const v of views) {
            const btn = document.createElement('button')
            btn.type = 'button'
            btn.className = 'view-picker-btn' + (v.key === activeView ? ' active' : '')
            btn.textContent = v.icon ?? ''
            if (v.label) btn.title = v.label
            btn.addEventListener('click', e => {
                e.stopPropagation()
                if (v.key === activeView) return
                activeView = v.key
                buttons.forEach((b, k) => b.classList.toggle('active', k === v.key))
                if (storageKey) localStorage.setItem(storageKey, activeView)
                if (onViewChange) onViewChange(activeView)
            })
            buttons.set(v.key, btn)
            picker.appendChild(btn)
        }
        header.appendChild(picker)
    } else if (views.length === 1) {
        const label = document.createElement('span')
        label.className = 'view-picker-label'
        label.textContent = views[0].label ?? views[0].key ?? ''
        header.appendChild(label)
    }

    el.appendChild(header)

    // ── Filter bar ────────────────────────────────────────────────────────
    if (filters.length > 0) {
        const filterBar = document.createElement('div')
        filterBar.className = 'container-filter'

        filters.forEach(f => {
            if (f.type === 'select') {
                const sel = document.createElement('select')
                sel.className = 'select'
                sel.style.cssText = 'width:auto; height:var(--h-btn-sm);'
                ;(f.options ?? []).forEach(opt => {
                    const o = document.createElement('option')
                    o.textContent = opt
                    sel.appendChild(o)
                })
                if (f.onChange) sel.addEventListener('change', () => f.onChange(sel.value))
                filterBar.appendChild(sel)
            } else if (f.type === 'search') {
                const inp = document.createElement('input')
                inp.className = 'input'
                inp.style.cssText = 'width:160px; height:var(--h-btn-sm);'
                inp.placeholder = f.placeholder ?? ''
                if (f.onInput) inp.addEventListener('input', () => f.onInput(inp.value))
                filterBar.appendChild(inp)
            }
        })

        el.appendChild(filterBar)
    }

    // ── Body ──────────────────────────────────────────────────────────────
    const body = document.createElement('div')
    body.className = flush ? 'container-body-flush' : 'container-body'
    el.appendChild(body)

    // ── API ───────────────────────────────────────────────────────────────
    function setContent(content) {
        body.innerHTML = ''
        if (typeof content === 'string') {
            body.innerHTML = content
        } else if (content instanceof Node) {
            body.appendChild(content)
        }
    }

    return {
        el, body, setContent,
        get activeView() { return activeView },
    }
}
