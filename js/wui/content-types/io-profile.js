/* wirezat-ui-v1 / js/wui/content-types/io-profile.js
   wui content-type "io-profile": reshapes {itemKey, rate, section} rows into
   a grouped table (reuses the "table" content-type — no separate visual
   component exists for IO profiles today).

   Usage:
     import { render } from '/js/wui/content-types/io-profile.js'
     const { el } = render({
       rows: [
         { itemKey: 'Iron Ingot', rate: '16/s', section: 'Inputs' },
         { itemKey: 'Iron Plate', rate: '16/s', section: 'Outputs' },
       ],
     })
*/

import { render as renderTableContent } from './table.js'

export function render(content) {
    const table = renderTableContent(_toTableConfig(content))
    return {
        el: table.el,
        // Wrapped rather than returning table.update directly: this type's
        // own update() must accept io-profile-shaped partials ({rows: [{itemKey,...}]}),
        // not table-shaped ones ({columns, rows}) — so each call re-derives
        // the table config from the merged io-profile content.
        update(partial) { table.update(_toTableConfig({ ...content, ...partial })) },
    }
}

function _toTableConfig(content) {
    const rows = []
    let lastSection = null
    for (const r of content.rows ?? []) {
        if (r.section && r.section !== lastSection) {
            rows.push({ group: r.section })
            lastSection = r.section
        }
        rows.push({ item: r.itemKey, rate: r.rate })
    }
    return {
        columns: [
            { key: 'item', labelKey: 'common.item', grow: true },
            { key: 'rate', labelKey: 'common.rate' },
        ],
        rows,
    }
}
