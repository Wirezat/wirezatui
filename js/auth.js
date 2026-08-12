/* wirezat-ui-v1 / js/auth.js
   Session management (JWT tokens, getUser, logout, apiFetch) and
   login page init (initAuth).
*/

import { initDropdowns } from './dropdown.js';
import { initThemeBtn }  from './theme.js';

// ── Session management ────────────────────────────────────────────────────────

const _cfg = {
    loginPath:  '/login.html',
    logoutApi:  '/api/auth/logout',
    refreshApi: '/api/auth/refresh',
    meApi:      '/api/me',
};

export function configure(opts) { Object.assign(_cfg, opts); }

export function getToken()   { return localStorage.getItem('access_token'); }
export function getRefresh() { return localStorage.getItem('refresh_token'); }

function _setTokens(a, r) {
    localStorage.setItem('access_token',  a);
    localStorage.setItem('refresh_token', r);
}

export function logout() {
    const token   = getToken();
    const refresh = getRefresh();
    if (token) {
        fetch(_cfg.logoutApi, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body:    JSON.stringify({ refresh_token: refresh || '' }),
        }).catch(() => {});
    }
    localStorage.clear();
    window.location.href = _cfg.loginPath;
}

async function _refresh() {
    const r = getRefresh();
    if (!r) return false;
    try {
        const res = await fetch(_cfg.refreshApi, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ refresh_token: r }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        _setTokens(data.access_token, data.refresh_token);
        return true;
    } catch { return false; }
}

export async function apiFetch(url, options = {}, { silent401 = false } = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let res = await fetch(url, { ...options, headers });

    // A 401 with no token just means "not logged in" (e.g. /api/me from an
    // unauthenticated demo visitor) — that's an expected, non-fatal outcome
    // for the caller to handle, not a session that needs bouncing.
    if (res.status === 401 && !token) return res;

    if (res.status === 401) {
        const ok = await _refresh();
        if (!ok) {
            // On public pages a dead session just means "treat as logged out" —
            // bouncing to /login would break pages that never required auth.
            if (silent401) return res;
            logout();
            return null;
        }
        const newHeaders = { ...headers, 'Authorization': 'Bearer ' + getToken() };
        res = await fetch(url, { ...options, headers: newHeaders });
        if (res.status === 401) {
            if (silent401) return res;
            logout();
            return null;
        }
    }
    return res;
}

export function guard() {
    if (!getToken() && !getRefresh()) window.location.href = _cfg.loginPath;
}

let _user = null;

export async function getUser({ silent401 = false } = {}) {
    if (_user) return _user;
    const res = await apiFetch(_cfg.meApi, {}, { silent401 });
    if (!res || !res.ok) return null;
    _user = await res.json();
    return _user;
}

export function setUser(u) { _user = u; }
export function isAdmin()  { return !!(_user && _user.is_admin); }

export function applyRoles() {
    if (!_user) return;
    document.querySelectorAll('[data-requires]').forEach(el => {
        if (el.getAttribute('data-requires') === 'admin' && !_user.is_admin) el.remove();
    });
}


// ── Login page init ───────────────────────────────────────────────────────────

/*
   Usage:
     import { load, applyI18n, getLang, setLang, t } from '/static/js/i18n.js';
     import { initAuth } from '/static/ui/js/auth.js';
     await load(getLang());
     applyI18n();
     initAuth({
       name:     sp.get('name')     || 'App',
       logo:     sp.get('logo')     || '⚙️',
       subtitle: sp.get('subtitle') || '',
       mode:     sp.get('mode')     || 'both',
       redirect: sp.get('redirect') || '/',
     }, { t, getLang, setLang });

   Config defaults (all overridable):
     loginUrl:    '/api/auth/login'
     registerUrl: '/api/auth/register'
     configUrl:   '/api/auth/config'
     langFlags:   { en: '🇬🇧', de: '🇩🇪' }
*/

const DEFAULTS = {
    loginUrl:    '/api/auth/login',
    registerUrl: '/api/auth/register',
    configUrl:   '/api/auth/config',
    langFlags:   { en: '🇬🇧', de: '🇩🇪' },
};

export function initAuth(cfg, { t, getLang, setLang }) {
    const c = { ...DEFAULTS, ...cfg };

    // ── App identity ──────────────────────────────────────────────────────────
    const logoEl  = document.getElementById('auth-logo');
    const titleEl = document.getElementById('auth-title');
    const subEl   = document.getElementById('auth-sub');
    if (logoEl)  logoEl.textContent  = c.logo  ?? '⚙️';
    if (titleEl) titleEl.textContent = c.name  ?? 'App';
    if (subEl) {
        if (c.subtitle) subEl.textContent = c.subtitle;
        else subEl.style.display = 'none';
    }
    document.title = (c.name ?? 'App') + ' — ' + t('login.title');

    // ── Skip if already logged in ─────────────────────────────────────────────
    if (localStorage.getItem('access_token')) {
        window.location.href = c.redirect ?? '/';
        return;
    }

    // ── Mode (both / login-only / register-only / password-only) ─────────────
    function applyMode(mode) {
        const tabs          = document.getElementById('auth-tabs');
        const panelLogin    = document.getElementById('panel-login');
        const panelReg      = document.getElementById('panel-register');
        const panelPassword = document.getElementById('panel-password');
        if (mode === 'login') {
            if (tabs) tabs.style.display = 'none';
            panelLogin?.classList.add('active');
            panelReg?.classList.remove('active');
            panelPassword?.classList.remove('active');
        } else if (mode === 'register') {
            if (tabs) tabs.style.display = 'none';
            panelLogin?.classList.remove('active');
            panelReg?.classList.add('active');
            panelPassword?.classList.remove('active');
        } else if (mode === 'password') {
            if (tabs) tabs.style.display = 'none';
            panelLogin?.classList.remove('active');
            panelReg?.classList.remove('active');
            panelPassword?.classList.add('active');
        }
        // 'both' — default DOM state: tabs visible, login panel active, password hidden
    }
    applyMode(c.mode ?? 'both');

    // Check server config — may force login-only if registration is disabled.
    // Never overrides an explicit mode (login / register / password).
    if ((c.mode ?? 'both') === 'both') {
        fetch(c.configUrl)
            .then(r => r.json())
            .then(api => { if (!api.registration_enabled) applyMode('login'); })
            .catch(() => {});
    }

    // ── Tab switching ─────────────────────────────────────────────────────────
    function switchTab(name) {
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.toggle('active', tab.id === 'tab-' + name);
        });
        document.getElementById('panel-login')?.classList.toggle('active', name === 'login');
        document.getElementById('panel-register')?.classList.toggle('active', name === 'register');
    }
    document.getElementById('tab-login')?.addEventListener('click', () => switchTab('login'));
    document.getElementById('tab-register')?.addEventListener('click', () => switchTab('register'));

    // ── Password match indicator ──────────────────────────────────────────────
    function checkMatch() {
        const pw1  = document.getElementById('reg-password')?.value ?? '';
        const pw2  = document.getElementById('reg-confirm')?.value  ?? '';
        const icon = document.getElementById('reg-match-icon');
        const wrap = document.getElementById('reg-confirm-wrap');
        if (!pw2) {
            if (icon) icon.textContent = '';
            if (wrap) wrap.className = 'input-wrap';
            return;
        }
        const ok = pw1 === pw2;
        if (icon) icon.textContent = ok ? '✓' : '✗';
        if (wrap) wrap.className   = 'input-wrap ' + (ok ? 'input-wrap-ok' : 'input-wrap-err');
    }
    document.getElementById('reg-password')?.addEventListener('input', checkMatch);
    document.getElementById('reg-confirm')?.addEventListener('input', checkMatch);

    // ── Status helpers ────────────────────────────────────────────────────────
    function showStatus(id, cls, text) {
        const el = document.getElementById(id);
        if (!el) return;
        el.className = 'status-msg ' + cls;
        el.textContent = text;
    }
    function clearStatus(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.className = 'status-msg';
        el.textContent = '';
    }

    // ── Login ─────────────────────────────────────────────────────────────────
    async function doLogin() {
        clearStatus('status-login');
        const username = document.getElementById('login-username')?.value.trim() ?? '';
        const password = document.getElementById('login-password')?.value ?? '';
        if (!username || !password) {
            showStatus('status-login', 'err', t('msg.fill_all_fields'));
            return;
        }
        try {
            const res  = await fetch(c.loginUrl, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!res.ok) { showStatus('status-login', 'err', data.message || t('msg.login_failed')); return; }
            localStorage.setItem('access_token',  data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            window.location.href = c.redirect ?? '/';
        } catch { showStatus('status-login', 'err', t('msg.network_error')); }
    }
    document.getElementById('login-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    document.getElementById('btn-login')?.addEventListener('click', doLogin);

    // ── Register ──────────────────────────────────────────────────────────────
    async function doRegister() {
        clearStatus('status-reg');
        const username = document.getElementById('reg-username')?.value.trim() ?? '';
        const password = document.getElementById('reg-password')?.value ?? '';
        const confirm  = document.getElementById('reg-confirm')?.value  ?? '';
        if (!username || !password) {
            showStatus('status-reg', 'err', t('msg.fill_all_fields'));
            return;
        }
        if (password !== confirm) {
            showStatus('status-reg', 'err', t('msg.passwords_no_match'));
            return;
        }
        try {
            const res  = await fetch(c.registerUrl, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!res.ok) { showStatus('status-reg', 'err', data.message || t('msg.registration_failed')); return; }
            localStorage.setItem('access_token',  data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            window.location.href = c.redirect ?? '/';
        } catch { showStatus('status-reg', 'err', t('msg.network_error')); }
    }
    document.getElementById('reg-confirm')?.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
    document.getElementById('btn-register')?.addEventListener('click', doRegister);

    // ── Password-only ─────────────────────────────────────────────────────────
    async function doPassword() {
        clearStatus('status-password');
        const password = document.getElementById('password-only')?.value ?? '';
        if (!password) { showStatus('status-password', 'err', t('msg.fill_all_fields')); return; }
        try {
            if (c.onPassword) {
                const result = await c.onPassword(password);
                if (!result?.ok) { showStatus('status-password', 'err', result?.message || t('msg.login_failed')); return; }
            } else if (c.passwordUrl) {
                const res  = await fetch(c.passwordUrl, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ password }),
                });
                const data = await res.json();
                if (!res.ok) { showStatus('status-password', 'err', data.message || t('msg.login_failed')); return; }
            }
            if (c.onSuccess) c.onSuccess();
            else window.location.href = c.redirect ?? '/';
        } catch { showStatus('status-password', 'err', t('msg.network_error')); }
    }
    document.getElementById('password-only')?.addEventListener('keydown', e => { if (e.key === 'Enter') doPassword(); });
    document.getElementById('btn-password')?.addEventListener('click', doPassword);

    // ── Theme + lang ──────────────────────────────────────────────────────────
    initThemeBtn();

    const flags   = c.langFlags ?? DEFAULTS.langFlags;
    const langWrap = document.querySelector('[data-wui-lang]');
    if (langWrap) {
        const langBtn = langWrap.querySelector('[data-dropdown-trigger]');
        if (langBtn) langBtn.textContent = flags[getLang()] ?? '🌐';
        langWrap.querySelectorAll('[data-lang]').forEach(opt => {
            if (opt.dataset.lang === getLang()) opt.classList.add('active');
            opt.addEventListener('click', () => setLang(opt.dataset.lang));
        });
    }

    initDropdowns();
}
