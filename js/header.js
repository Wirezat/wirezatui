/* wirezat-ui-v1 / js/header.js
   App header init: lang switcher, user menu, sidebar nav.

   Usage:
     import { init } from '/static/ui/js/header.js';
     init({
       navLinks:      [{ href, icon, label, activeFor? }, ...],
       adminSections: ['<a class="dropdown-item" href="/admin">…</a>', ...],
       getLang:       () => string,
       setLang:       (lang: string) => void,
       labels:        { personal?, logout?, admin?, user? },
     });
*/

import { initDropdowns } from './dropdown.js';
import { initThemeBtn }  from './theme.js';
import { getUser, applyRoles, logout } from './auth.js';

const LANG_FLAGS = { en: '🇬🇧', de: '🇩🇪' };

const DEFAULT_LABELS = {
    personal: 'Personal',
    logout:   'Sign out',
    admin:    'Administrator',
    user:     'User',
    demo:     'Try demo',
};

let _user = null;

export async function init({ navLinks = [], adminSections = [], labels = {}, getLang = null, setLang = null } = {}) {
    const lbl = { ...DEFAULT_LABELS, ...labels };
    initThemeBtn();
    _initLangBtn(getLang, setLang);
    _buildSidebar(navLinks);
    initDropdowns();
    try {
        _user = await getUser();
        if (!_user) return;
    } catch (_) { return; }
    _renderTrigger();
    _buildDropdown(adminSections, lbl);
    applyRoles();
}

function _initLangBtn(getLang, setLang) {
    const wrap = document.querySelector('[data-wui-lang]');
    if (!wrap || !getLang) return;
    const btn = wrap.querySelector('[data-dropdown-trigger]');
    if (btn) {
        btn.classList.add('btn', 'btn-icon', 'btn-sm', 'btn-icon-color');
        btn.style.setProperty('--_icon-color', 'var(--text-muted)');
        btn.textContent = LANG_FLAGS[getLang()] || '🌐';
    }
    if (!setLang) return;
    wrap.querySelectorAll('[data-lang]').forEach(opt => {
        if (opt.dataset.lang === getLang()) opt.classList.add('active');
        opt.addEventListener('click', () => setLang(opt.dataset.lang));
    });
}

function _buildSidebar(links) {
    const nav = document.querySelector('nav.sidebar');
    if (!nav) return;
    const p = window.location.pathname;

    const isActive = href => {
        const extras = href._activeFor || [];
        return p === href || extras.some(prefix => p.startsWith(prefix));
    };

    const link = ({ href, icon, label, activeFor }) => {
        const a = { href, _activeFor: activeFor || [] };
        return `<a class="nav-link${isActive(a) ? ' active' : ''}" href="${href}"><i class="nav-icon">${icon}</i> ${label}</a>`;
    };

    let html = '';
    for (const item of links) {
        if (item.section) {
            html += `<span class="nav-section">${item.section}</span>`;
        } else {
            html += link(item);
        }
    }
    nav.innerHTML = html;
}

function _renderTrigger() {
    const trigger = document.querySelector('[data-wui-user-trigger]');
    if (!trigger) return;
    trigger.querySelector('.avatar').textContent   = (_user.username || '?').charAt(0).toUpperCase();
    trigger.querySelector('.username').textContent = _user.username;
}

function _buildDropdown(adminSections, lbl) {
    const dropdown = document.querySelector('[data-wui-user-dropdown]');
    if (!dropdown) return;

    const sections = [];

    sections.push(`
        <div class="user-dropdown-section">
            <a class="dropdown-item" href="/personal">
                <span class="icon">👤</span> ${lbl.personal}
            </a>
            <a class="dropdown-item" href="/demo/solve">
                <span class="icon">🧪</span> ${lbl.demo}
            </a>
        </div>`);

    if (_user.is_admin && adminSections.length) {
        sections.push(`<div class="user-dropdown-section">${adminSections.join('')}</div>`);
    }

    sections.push(`
        <div class="user-dropdown-section">
            <button class="dropdown-item danger" id="logout-btn">
                <span class="icon">🚪</span> ${lbl.logout}
            </button>
        </div>`);

    dropdown.innerHTML = `
        <div class="user-dropdown-header">
            <div class="user-dropdown-name">${_esc(_user.username)}</div>
            <div class="user-dropdown-role">${_user.is_admin ? lbl.admin : lbl.user}</div>
        </div>
        ${sections.join('')}`;

    document.getElementById('logout-btn')?.addEventListener('click', () => logout());
}

function _esc(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
