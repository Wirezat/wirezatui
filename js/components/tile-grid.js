/* wirezat-ui-v1 / js/components/tile-grid.js
   Factory: renders a tile grid (3-row tiles or stat-tiles) into a container.

   Usage:
     import { renderTileGrid, renderStatGrid } from '/ui/js/components/tile-grid.js'

     renderTileGrid(parentEl, items, {
       onNew:    () => {},                // if set, renders a "+ New" tile
       onDelete: (item) => {},            // if set, renders delete button on hover
       newLabel: '+ Neu',
     })

     // items: [{ title, subtitle?, meta?, href? }]

     renderStatGrid(parentEl, stats)
     // stats: [{ value, label }]
*/

export function renderTileGrid(parent, items = [], {
    onNew    = null,
    onDelete = null,
    newLabel = '+ Neu',
} = {}) {
    parent.innerHTML = ''
    const grid = document.createElement('div')
    grid.className = 'tile-grid'

    items.forEach(item => {
        const tile = document.createElement(item.href ? 'a' : 'div')
        tile.className = 'tile'
        if (item.href) tile.href = item.href

        tile.innerHTML = `
            <div class="tile-title">${esc(item.title)}</div>
            ${item.subtitle ? `<div class="tile-subtitle">${esc(item.subtitle)}</div>` : ''}
            ${item.meta     ? `<div class="tile-meta">${esc(item.meta)}</div>` : ''}`

        if (onDelete) {
            const del = document.createElement('button')
            del.className = 'btn btn-icon btn-sm btn-danger-ghost tile-action'
            del.textContent = '✕'
            del.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); onDelete(item) })
            tile.appendChild(del)
        }

        grid.appendChild(tile)
    })

    if (onNew) {
        const newTile = document.createElement('button')
        newTile.className = 'tile tile-new'
        newTile.textContent = newLabel
        newTile.addEventListener('click', onNew)
        grid.appendChild(newTile)
    }

    parent.appendChild(grid)
    return grid
}

export function renderStatGrid(parent, stats = []) {
    parent.innerHTML = ''
    const grid = document.createElement('div')
    grid.className = 'stat-grid'

    stats.forEach(s => {
        const tile = document.createElement('div')
        tile.className = 'stat-tile'
        tile.innerHTML = `
            <span class="stat-tile-value">${esc(String(s.value))}</span>
            <span class="stat-tile-label">${esc(s.label)}</span>`
        grid.appendChild(tile)
    })

    parent.appendChild(grid)
    return grid
}

function esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
