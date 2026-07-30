/* wirezat-ui-v1 / js/wui/content-types/raw.js
   wui content-type "raw": escape hatch for a caller-supplied DOM node.
   No update optimization — callers replace via the container's setContent().

   Usage:
     import { render } from '/js/wui/content-types/raw.js'
     render({ node: myCustomElement })
*/

export function render(content) {
    if (!(content.node instanceof Node)) {
        throw new Error('wui raw content: "node" must be a DOM Node')
    }
    return { el: content.node, update: null }
}
