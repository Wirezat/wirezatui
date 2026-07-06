/* wirezat-ui-v1 / js/actions.js
   Reusable action-button factory — define common row/toolbar controls once
   (delete, toggle, edit, copy, download …) instead of re-building the same
   markup on every page.

   actionButton(opts) -> HTMLButtonElement | HTMLAnchorElement
     opts:
       icon     glyph/text shown in the button
       title    tooltip (also used for a11y)
       color    one of ICON_COLORS keys, or any CSS color/var
       active   true → rendered in the "accent" colour (for toggles)
       href     if set, returns an <a> (for downloads/links)
       download download filename for <a>
       onClick  handler; receives (event, el); click is stopped from bubbling

   Presets: deleteButton, toggleButton, editButton, copyButton, downloadButton
*/

const ICON_COLORS = {
    text:   'var(--text)',
    muted:  'var(--text-muted)',
    danger: 'var(--danger, #d94f4f)',
    accent: 'var(--accent, #4f8cd9)',
    warn:   'var(--warning, #e6a817)',
    ok:     'var(--success, #3fa45b)',
};

export function actionButton(opts = {}) {
    const { icon = '', title = '', color = 'text', active = false,
            href = null, download = null, onClick = null } = opts;
    const el = href !== null ? document.createElement('a') : document.createElement('button');
    el.className = 'btn btn-icon btn-sm btn-icon-color';
    const c = active ? ICON_COLORS.accent : (ICON_COLORS[color] || color);
    el.style.setProperty('--_icon-color', c);
    if (title) el.title = title;
    el.textContent = icon;
    if (href !== null) { el.href = href; if (download) el.download = download; }
    if (onClick) el.addEventListener('click', e => { e.stopPropagation(); onClick(e, el); });
    return el;
}

export const deleteButton   = o => actionButton({ icon: '🗑', color: 'danger', ...o });
export const editButton     = o => actionButton({ icon: '✎', ...o });

// toggleButton is a real two-state control: monochrome, filled when ON,
// faint-outline when OFF, with aria-pressed reflecting state. The glyph stays the
// SAME in both states — the chrome (outline vs inverted fill) signals on/off.
// Default glyph is a monochrome text mark (inherits CSS colour, no emoji colour).
export function toggleButton(opts = {}) {
    const { icon = '⍑', title = '', active = false, onClick = null } = opts;
    const el = document.createElement('button');
    el.className = 'btn btn-icon btn-sm btn-toggle';
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (title) el.title = title;
    el.textContent = icon;
    if (onClick) el.addEventListener('click', e => { e.stopPropagation(); onClick(e, el); });
    return el;
}
export const copyButton     = o => actionButton({ icon: '⎘', ...o });
export const downloadButton = o => actionButton({ icon: '⬇', href: '#', ...o });
