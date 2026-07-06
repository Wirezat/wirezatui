/* wirezat-ui-v1 / js/components/container.js
   Factory: creates a data container with header, optional filter bar, and body.

   Usage:
     import { createContainer } from '/ui/js/components/container.js'

     const c = createContainer({
       title:       'Welten',
       view:        'Kacheln',          // label when single view
       views:       ['Kacheln','Liste'], // array → dropdown picker
       config:      true,               // adds container-config class (purple tint)
       filters:     [                   // optional filter controls
         { type: 'select', options: ['Alle', 'Aktiv'], placeholder: 'Status' },
         { type: 'search', placeholder: 'Suche…' }
       ],
       flush:       true,               // container-body-flush (for tables)
       onViewChange: (view) => {},
     })
     parentEl.appendChild(c.el)
     // Update body content:
     c.setContent('<p>…</p>')
     c.setContent(domElement)
*/

export function createContainer({
    title        = '',
    view         = null,
    views        = [],
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

    // View picker
    if (views.length > 1) {
        const picker = document.createElement('button')
        picker.className = 'view-picker'
        picker.textContent = (view ?? views[0]) + ' ▾'
        picker.addEventListener('click', e => {
            e.stopPropagation()
            // Simple inline picker — swap through views
            const current = views.indexOf(picker.textContent.replace(' ▾', ''))
            const next = views[(current + 1) % views.length]
            picker.textContent = next + ' ▾'
            if (onViewChange) onViewChange(next)
        })
        header.appendChild(picker)
    } else {
        const label = document.createElement('span')
        label.className = 'view-picker-label'
        label.textContent = view ?? (views[0] ?? '')
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

    return { el, body, setContent }
}
