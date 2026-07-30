/* wirezat-ui-v1 / js/wui/content-types/table.js
   wui content-type "table": thin data-config wrapper around
   components/table.js's renderTable.

   Usage:
     import { render } from '/js/wui/content-types/table.js'
     const { el, update } = render({
       columns: [{ key: 'name', labelKey: 'common.name', grow: true }],
       rows: [{ name: 'Iron' }],
     })
*/

import { renderTable } from '../../components/table.js'
import { t } from '../../i18n.js'

export function render(content) {
    const host = document.createElement('div')
    let current = content

    function build(cfg) {
        current = cfg
        const rowAction = cfg.rowActions?.[0] ?? null
        renderTable(host, {
            cols: (cfg.columns ?? []).map(c => ({
                key:    c.key,
                label:  t(c.labelKey),
                grow:   c.grow,
                cls:    c.cls,
                render: c.render,
            })),
            rows:         cfg.rows ?? [],
            checklist:    !!cfg.checklist,
            emptyMessage: cfg.emptyMessageKey ? t(cfg.emptyMessageKey) : undefined,
            onCheck:      cfg.onCheck ?? null,
            onAction:     rowAction?.onClick ?? null,
            actionLabel:  rowAction?.labelKey ? t(rowAction.labelKey) : undefined,
        })
    }

    build(content)
    return {
        el: host,
        update(partial) { build({ ...current, ...partial }) },
    }
}
