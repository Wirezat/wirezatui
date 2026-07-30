/* wirezat-ui-v1 / js/wui/content-types/index.js
   Dispatches a wui content config to its renderer by content.type.

   Usage:
     import { renderContent } from '/js/wui/content-types/index.js'
     const { el, update } = renderContent({ type: 'table', columns: [...], rows: [...] })
*/

import { render as renderTable }     from './table.js'
import { render as renderTiles }     from './tiles.js'
import { render as renderForm }      from './form.js'
import { render as renderGraphType } from './graph.js'
import { render as renderIoProfile } from './io-profile.js'
import { render as renderRaw }       from './raw.js'

const RENDERERS = {
    table:        renderTable,
    tiles:        renderTiles,
    form:         renderForm,
    graph:        renderGraphType,
    'io-profile': renderIoProfile,
    raw:          renderRaw,
}

export function renderContent(content) {
    const renderer = RENDERERS[content?.type]
    if (!renderer) {
        throw new Error(`wui: unknown content.type "${content?.type}"`)
    }
    return renderer(content)
}
