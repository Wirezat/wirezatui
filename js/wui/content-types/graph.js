/* wirezat-ui-v1 / js/wui/content-types/graph.js
   wui content-type "graph": thin data-config wrapper around
   components/graph.js's renderGraph. No behavior change — same node/edge
   shape, just resolves fullscreenLabelKey via t().

   Usage:
     import { render } from '/js/wui/content-types/graph.js'
     const { el, update } = render({
       nodes: [{ id: 'a', level: 0, title: 'Result' }],
       edges: [],
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
        renderGraph(host, { nodes: cfg.nodes ?? [], edges: cfg.edges ?? [] }, {
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
