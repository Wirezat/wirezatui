/* wirezat-ui-v1 / js/components/drawer.js
   Usage: import { openDrawer } from '/ui/js/components/drawer.js'
     openDrawer({ side: 'right', titleKey: 'Filter', content: node, actions: [...] })
*/

export function openDrawer({ side = 'right', titleKey, content, actions = [] } = {}) {
    const backdrop = document.createElement('div')
    backdrop.className = 'drawer-backdrop'
    const drawer = document.createElement('div')
    drawer.className = `drawer ${side}`
    drawer.innerHTML = `
        <div class="drawer-header">${titleKey ? esc(titleKey) : ''}</div>
        <div class="drawer-body"></div>
        <div class="drawer-footer"></div>`
    drawer.querySelector('.drawer-body').appendChild(content)
    const footer = drawer.querySelector('.drawer-footer')
    for (const a of actions) {
        const btn = document.createElement('button')
        btn.className = `btn btn-${a.variant || 'ghost'}`
        btn.textContent = a.labelKey
        btn.onclick = a.onClick
        footer.appendChild(btn)
    }
    document.body.append(backdrop, drawer)
    backdrop.addEventListener('click', close)
    function close() { backdrop.remove(); drawer.remove() }
    return { close }
}

function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
