/* wirezat-ui-v1 / js/components/command-palette.js
   Usage: import { openCommandPalette } from '/ui/js/components/command-palette.js'
     openCommandPalette([{ labelKey: 'Neue Linie', kbd: '↵', onSelect: () => {} }])
*/

export function openCommandPalette(items = []) {
    const backdrop = document.createElement('div')
    backdrop.className = 'cmdk-backdrop'
    backdrop.innerHTML = `
        <div class="cmdk-panel">
            <input class="cmdk-input" placeholder="Befehl oder Seite suchen…" autofocus>
            <div class="cmdk-list"></div>
        </div>`
    document.body.appendChild(backdrop)

    const input = backdrop.querySelector('.cmdk-input')
    const list  = backdrop.querySelector('.cmdk-list')

    function render(filtered) {
        list.innerHTML = filtered.map((it, i) => `
            <div class="cmdk-row${i === 0 ? ' active' : ''}" data-idx="${i}">
                <span>${esc(it.labelKey)}</span>
                ${it.kbd ? `<span class="kbd">${esc(it.kbd)}</span>` : ''}
            </div>`).join('')
    }
    render(items)

    input.addEventListener('input', () => {
        const q = input.value.toLowerCase()
        render(items.filter(it => it.labelKey.toLowerCase().includes(q)))
    })
    list.addEventListener('click', e => {
        const row = e.target.closest('[data-idx]')
        if (!row) return
        items[Number(row.dataset.idx)].onSelect()
        close()
    })
    function close() { backdrop.remove(); document.removeEventListener('keydown', onKey) }
    function onKey(e) { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close() })

    return { close }
}

function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
