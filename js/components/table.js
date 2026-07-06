/* wirezat-ui-v1 / js/components/table.js
   Factory: renders a data table with group headers, expandable rows, empty state.

   Usage:
     import { renderTable } from '/ui/js/components/table.js'

     renderTable(parentEl, {
       cols: [
         { key: 'name',   label: 'Name',   grow: true },
         { key: 'rate',   label: 'Rate',   cls: 'td-mono' },
         { key: 'status', label: 'Status', render: (val) => `<span class="badge">${val}</span>` },
       ],
       rows: [
         { group: 'Gruppe A' },           // group header row
         { name: 'Eisen', rate: '16/s', status: 'aktiv' },
         { name: 'Kupfer', rate: '8/s',  status: 'geplant',
           expand: '<p>Detail-Inhalt</p>' },  // expandable
       ],
       checklist: false,      // adds checkbox column
       emptyMessage: 'Keine Einträge vorhanden',
       onCheck: (row, checked) => {},   // checklist callback
       onAction: (row) => {},           // action button callback
       actionLabel: '…',
     })
*/

export function renderTable(parent, {
    cols         = [],
    rows         = [],
    checklist    = false,
    emptyMessage = 'Keine Einträge vorhanden',
    onCheck      = null,
    onAction     = null,
    actionLabel  = '…',
} = {}) {
    parent.innerHTML = ''
    const table = document.createElement('table')
    table.className = 'table' + (checklist ? ' table-checklist' : '')

    // ── Head ──────────────────────────────────────────────────────────────
    const thead = document.createElement('thead')
    const hrow  = document.createElement('tr')
    cols.forEach(col => {
        const th = document.createElement('th')
        th.textContent = col.label
        if (col.grow) th.style.width = '100%'
        hrow.appendChild(th)
    })
    if (checklist) {
        const th = document.createElement('th')
        th.className = 'check-col'
        th.textContent = '✓'
        hrow.appendChild(th)
    }
    if (onAction) {
        const th = document.createElement('th')
        th.className = 'td-actions'
        hrow.appendChild(th)
    }
    thead.appendChild(hrow)
    table.appendChild(thead)

    // ── Body ──────────────────────────────────────────────────────────────
    const tbody = document.createElement('tbody')
    const dataRows = rows.filter(r => !r.group)

    let expandIdx = 0
    rows.forEach(row => {
        if (row.group) {
            const tr = document.createElement('tr')
            tr.className = 'table-group-hd'
            const td = document.createElement('td')
            td.colSpan = cols.length + (checklist ? 1 : 0) + (onAction ? 1 : 0)
            td.textContent = row.group
            tr.appendChild(td)
            tbody.appendChild(tr)
            return
        }

        const tr = document.createElement('tr')
        cols.forEach(col => {
            const td = document.createElement('td')
            if (col.cls) td.className = col.cls
            td.innerHTML = col.render ? col.render(row[col.key], row) : esc(String(row[col.key] ?? ''))
            tr.appendChild(td)
        })

        if (checklist) {
            const td = document.createElement('td')
            td.className = 'check-col'
            const cb = document.createElement('input')
            cb.type = 'checkbox'
            cb.checked = !!row.checked
            if (onCheck) cb.addEventListener('change', () => onCheck(row, cb.checked))
            td.appendChild(cb)
            tr.appendChild(td)
        }

        if (onAction) {
            const td = document.createElement('td')
            td.className = 'td-actions'
            const btn = document.createElement('button')
            btn.className = 'btn btn-sm btn-ghost'
            btn.textContent = actionLabel
            btn.addEventListener('click', () => onAction(row))
            td.appendChild(btn)
            tr.appendChild(td)
        }

        tbody.appendChild(tr)

        // Expandable row
        if (row.expand) {
            const id = `expand-${expandIdx++}`
            tr.querySelector('td')?.classList.add('table-expand-trigger')
            tr.querySelector('td')?.setAttribute('data-expand', id)

            const expTr = document.createElement('tr')
            expTr.className = 'table-expand-row'
            expTr.id = id
            const expTd = document.createElement('td')
            expTd.colSpan = cols.length + (checklist ? 1 : 0) + (onAction ? 1 : 0)
            const expBody = document.createElement('div')
            expBody.className = 'table-expand-body'
            expBody.innerHTML = row.expand
            expTd.appendChild(expBody)
            expTr.appendChild(expTd)
            tbody.appendChild(expTr)
        }
    })

    // Empty state
    if (dataRows.length === 0) {
        const colSpan = cols.length + (checklist ? 1 : 0) + (onAction ? 1 : 0)
        for (let i = 0; i < 5; i++) {
            const tr = document.createElement('tr')
            tr.className = 'table-placeholder-row'
            cols.forEach(() => {
                const td = document.createElement('td')
                td.textContent = '—'
                tr.appendChild(td)
            })
            tbody.appendChild(tr)
        }
        const emptyTr = document.createElement('tr')
        emptyTr.className = 'table-empty-row'
        const emptyTd = document.createElement('td')
        emptyTd.colSpan = colSpan
        emptyTd.textContent = emptyMessage
        emptyTr.appendChild(emptyTd)
        tbody.appendChild(emptyTr)
    }

    table.appendChild(tbody)
    parent.appendChild(table)

    // Wire expand triggers
    table.addEventListener('click', e => {
        const trigger = e.target.closest('[data-expand]')
        if (!trigger) return
        const panel = document.getElementById(trigger.dataset.expand)
        panel?.classList.toggle('open')
    })

    return table
}

function esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
