/* wirezat-ui-v1 / js/wui/content-types/tiles.js
   wui content-type "tiles": thin data-config wrapper around
   components/tile-grid.js's renderTileGrid / renderStatGrid.

   Usage:
     import { render } from '/js/wui/content-types/tiles.js'
     const { el, update } = render({
       items: [{ titleKey: 'save.tile.default', href: '/save/1' }],
       onNew: () => {},
     })
*/

import { renderTileGrid, renderStatGrid } from '../../components/tile-grid.js'
import { t } from '../../i18n.js'

export function render(content) {
    const host = document.createElement('div')
    let current = content

    function build(cfg) {
        current = cfg
        if (cfg.stats) {
            renderStatGrid(host, cfg.stats.map(s => ({ value: s.value, label: t(s.labelKey) })))
            return
        }
        renderTileGrid(host, (cfg.items ?? []).map(i => ({
            title:    t(i.titleKey),
            subtitle: i.subtitleKey ? t(i.subtitleKey) : undefined,
            meta:     i.meta,
            href:     i.href,
        })), {
            onNew:    cfg.onNew ?? null,
            onDelete: cfg.onDelete ?? null,
            newLabel: cfg.addNewLabelKey ? t(cfg.addNewLabelKey) : undefined,
        })
    }

    build(content)
    return {
        el: host,
        update(partial) { build({ ...current, ...partial }) },
    }
}
