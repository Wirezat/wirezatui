/* wirezat-ui-v1 / js/wui/content-types/graph.js
   wui content-type "graph": thin data-config wrapper around
   components/graph.js's renderGraph. Same node shape, just resolves
   fullscreenLabelKey via t().

   There is no separate edges[] — each node declares its own dependencies
   via dependsOn, matching renderGraph's signature.

   Usage:
     import { render } from '/js/wui/content-types/graph.js'
     const { el, update } = render({
       nodes: [
         { id: 'a', level: 0, title: 'Result', dependsOn: [{ to: 'b' }] },
         { id: 'b', level: 1, title: 'Iron' },
       ],
       fullscreenLabelKey: 'solve.graph.fullscreen',
     })
*/

import { renderGraph } from '../../components/graph.js'
import { t } from '../../i18n.js'

export function render(content) {
    const host = document.createElement('div')
    let current = content

    function build(cfg) {
        current = cfg
        host.innerHTML = ''
        renderGraph(host, { nodes: cfg.nodes ?? [] }, {
            fullscreenLabel: cfg.fullscreenLabelKey ? t(cfg.fullscreenLabelKey) : '',
            onMenuAction:    cfg.onMenuAction ?? (() => {}),
        })
    }

    build(content)
    return {
        el: host,
        update(partial) { build({ ...current, ...partial }) },
    }
}
