/* wirezat-ui-v1 / js/theme.js
   Light / dark mode toggle. Persists preference in localStorage under 'theme'.

   Usage:
     initTheme()    — apply stored preference on page load (call in inline script)
     toggleTheme()  — flip mode
     initThemeBtn() — wire all [data-wui-theme] buttons on the page
*/

const KEY = 'theme';

export function initTheme() {
    const stored = localStorage.getItem(KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    _apply(stored ? stored === 'dark' : prefersDark);
}

export function toggleTheme() {
    const dark = !document.documentElement.classList.contains('dark');
    _apply(dark);
    localStorage.setItem(KEY, dark ? 'dark' : 'light');
    _updateAllBtns();
}

export function initThemeBtn() {
    document.querySelectorAll('[data-wui-theme]').forEach(btn => {
        btn.classList.add('btn', 'btn-icon', 'btn-sm', 'btn-icon-color');
        btn.style.setProperty('--_icon-color', 'var(--text-muted)');
        _updateBtn(btn);
        btn.addEventListener('click', toggleTheme);
    });
}

function _apply(dark) {
    document.documentElement.classList.toggle('dark', dark);
}

function _updateBtn(btn) {
    btn.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
}

function _updateAllBtns() {
    document.querySelectorAll('[data-wui-theme]').forEach(_updateBtn);
}
