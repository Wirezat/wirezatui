/* wirezat-ui-v1 / js/wui/accent-theme.js
   Applies a small set of core theme tokens as CSS custom properties on
   <html>, deriving hover/tint variants so callers only supply base colors.

   Usage:
     import { applyAccentTheme } from '/js/wui/accent-theme.js'
     applyAccentTheme({ accent: '#3b82f6', danger: '#dc2626' })
*/

const BASE_KEYS = {
    accent:    '--accent',
    danger:    '--danger',
    bg:        '--bg',
    text:      '--text',
    textMuted: '--text-muted',
    border:    '--border',
}

export function applyAccentTheme(theme = {}) {
    const root = document.documentElement
    for (const [key, cssVar] of Object.entries(BASE_KEYS)) {
        const value = theme[key]
        if (value == null) continue
        root.style.setProperty(cssVar, value)
    }
    if (theme.accent) {
        root.style.setProperty('--accent-hover', _shade(theme.accent, -12))
        root.style.setProperty('--accent-tint', _alpha(theme.accent, 0.12))
    }
    if (theme.danger) {
        root.style.setProperty('--danger-hover', _shade(theme.danger, -12))
    }
}

function _hexToRgb(hex) {
    const clean = hex.replace('#', '')
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
    const num = parseInt(full, 16)
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function _shade(hex, percent) {
    const { r, g, b } = _hexToRgb(hex)
    const amt = Math.round(2.55 * percent)
    const clamp = v => Math.max(0, Math.min(255, v + amt))
    return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`
}

function _alpha(hex, alpha) {
    const { r, g, b } = _hexToRgb(hex)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
