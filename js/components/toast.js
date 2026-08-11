/* wirezat-ui-v1 / js/components/toast.js
   Usage: import { showToast } from '/ui/js/components/toast.js'
     showToast({ tone: 'success', messageKey: 'Gespeichert', duration: 4000 })
*/

let stack = null
function ensureStack() {
    if (stack) return stack
    stack = document.createElement('div')
    stack.className = 'toast-stack'
    document.body.appendChild(stack)
    return stack
}

export function showToast({ tone = 'info', messageKey, action, duration = 4000 } = {}) {
    const el = document.createElement('div')
    el.className = 'toast' + (tone !== 'success' ? ` ${tone}` : '')
    el.innerHTML = `<span>${esc(messageKey)}</span>`
    if (action) {
        const btn = document.createElement('button')
        btn.className = 'btn btn-ghost btn-sm'
        btn.textContent = action.labelKey
        btn.onclick = action.onClick
        el.appendChild(btn)
    }
    ensureStack().appendChild(el)
    setTimeout(() => el.remove(), duration)
    return el
}

function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
