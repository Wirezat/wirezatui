/* wirezat-ui-v1 / js/wui/container-builder.js
   Builds one wui container from data config: wraps components/container.js's
   createContainer() for chrome (header/filters/view-picker) and dispatches
   the body content through content-types/index.js.

   Note: createContainer()'s `views` param is `[{key, icon, label}]` —
   rendered as a segmented row of icon buttons. wui's `views: [{key, icon,
   labelKey}]` config resolves labelKey → label here before passing through.

   Usage:
     import { buildContainer } from '/js/wui/container-builder.js'
     const handle = buildContainer({
       id: 'pl-table',
       title: 'factory.pl.title',
       content: { type: 'table', columns: [...], rows: [...] },
     })
     parentEl.appendChild(handle.el)
     handle.update({ rows: newRows })
*/

import { createContainer } from '../components/container.js'
import { renderContent }   from './content-types/index.js'
import { t }                from '../i18n.js'

export function buildContainer(cfg) {
    const {
        id         = null,
        title      = null,
        views      = [],
        view       = null,
        storageKey = null,
        filters    = [],
        config     = false,
        content    = null,
        onViewSelect = null,
    } = cfg

    const resolvedViews = views.map(v => ({ key: v.key, icon: v.icon, label: v.labelKey ? t(v.labelKey) : v.label }))

    const container = createContainer({
        title:   title ? t(title) : '',
        views:   resolvedViews,
        view,
        storageKey,
        config,
        filters: filters.map(_resolveFilter),
        flush:   content?.type === 'table' || content?.type === 'io-profile',
        onViewChange: resolvedViews.length > 1 ? key => onViewSelect?.(key) : null,
    })

    let currentContent = content
    let rendered = content ? renderContent(content) : null
    if (rendered) container.setContent(rendered.el)

    function update(partial) {
        if (!rendered) {
            throw new Error(`wui container "${id}": update() called before any content was set`)
        }
        if (rendered.update) {
            rendered.update(partial)
        } else {
            setContent({ ...currentContent, ...partial })
        }
    }

    function setContent(nextContent) {
        currentContent = nextContent
        rendered = renderContent(nextContent)
        container.setContent(rendered.el)
    }

    return { el: container.el, id, update, setContent }
}

function _resolveFilter(f) {
    return {
        type:        f.type,
        placeholder: f.placeholderKey ? t(f.placeholderKey) : '',
        options:     f.options,
        onChange:    f.onChange,
        onInput:     f.onInput,
    }
}
