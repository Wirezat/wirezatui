/* wirezat-ui-v1 / js/theme-check.js
   Warns once per base color still on its generic default — catches an app
   that forgot to set theme.css. Never a hard fail.
*/
const DEFAULTS = {
    '--accent':  '#3b82f6', '--danger': '#dc2626', '--success': '#16a34a',
    '--warn':    '#d97706', '--config': '#8b5cf6',  '--text':    '#d1d5db',
    '--border':  '#374151', '--bg':     '#111827',  '--bg-card': '#1f2937',
}

export function checkThemeTokens() {
    const style = getComputedStyle(document.documentElement)
    for (const [token, def] of Object.entries(DEFAULTS)) {
        const val = style.getPropertyValue(token).trim().toLowerCase()
        if (val === def) console.warn(`wui: ${token} is still on its generic default (${def}) — theme.css likely didn't set it.`)
    }
}
