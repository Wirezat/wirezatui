/* wirezat-ui-v1 / js/auth.js
   Session management (getUser, logout, apiFetch) and login page init (initAuth).

   Two transports, same surface — pick with configure({ mode }):

     'token'  (default)  Access and refresh token in localStorage, sent as a
                         Bearer header. Works across origins and for clients
                         that are not a browser, which is what a token API is
                         for. The cost: localStorage is readable by any script
                         on the page, so an XSS can carry the credentials off
                         and keep using them.

     'cookie'            The server sets an HttpOnly session cookie; every
                         request just rides along with credentials. Script
                         cannot read the cookie, so an XSS can act only while
                         the page is open and cannot exfiltrate anything.
                         Same-origin only, and the server must defend CSRF
                         (SameSite=Strict or a token).

   Neither is "the secure one" — they trade different risks. Pick 'token' when
   something other than a same-origin browser page has to authenticate, and
   'cookie' when nothing does.
*/

import { initDropdowns } from './dropdown.js';
import { initThemeBtn }  from './theme.js';

// ── Session management ────────────────────────────────────────────────────────

const _cfg = {
    mode:       'token',            // 'token' | 'cookie'
    loginPath:  '/login.html',
    loginApi:   '/api/auth/login',  // cookie mode: where initAuth posts
    logoutApi:  '/api/auth/logout',
    refreshApi: '/api/auth/refresh', // null = no refresh; a 401 is final
    meApi:      '/api/me',
};

export function configure(opts) { Object.assign(_cfg, opts); }

const _cookieMode = () => _cfg.mode === 'cookie';

/* Auth keys only — localStorage also holds the theme and language, and signing
   out is no reason to forget how someone likes to read the page. */
const AUTH_KEYS = ['access_token', 'refresh_token'];
function _clearTokens() { AUTH_KEYS.forEach(k => localStorage.removeItem(k)); }

export function getToken()   { return _cookieMode() ? null : localStorage.getItem('access_token'); }
export function getRefresh() { return _cookieMode() ? null : localStorage.getItem('refresh_token'); }

function _setTokens(a, r) {
    localStorage.setItem('access_token',  a);
    localStorage.setItem('refresh_token', r);
}

export function logout() {
    if (_cookieMode()) {
        // keepalive so the request survives the navigation below — otherwise
        // the server may never get to invalidate the session.
        fetch(_cfg.logoutApi, { method: 'POST', credentials: 'same-origin', keepalive: true })
            .catch(() => {});
    } else {
        const token = getToken();
        if (token) {
            fetch(_cfg.logoutApi, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body:    JSON.stringify({ refresh_token: getRefresh() || '' }),
                keepalive: true,
            }).catch(() => {});
        }
        _clearTokens();
    }
    _user = null;
    window.location.href = _cfg.loginPath;
}

async function _refresh() {
    if (!_cfg.refreshApi) return false;
    if (_cookieMode()) {
        try {
            // The refresh token is a cookie too, so there is nothing to send;
            // a successful response rotates the cookies server-side.
            const res = await fetch(_cfg.refreshApi, { method: 'POST', credentials: 'same-origin' });
            return res.ok;
        } catch { return false; }
    }
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

function _send(url, options) {
    const headers = options.body instanceof FormData
        ? { ...options.headers }
        : { 'Content-Type': 'application/json', ...options.headers };
    if (_cookieMode()) {
        return fetch(url, { ...options, headers, credentials: 'same-origin' });
    }
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(url, { ...options, headers });
}

export async function apiFetch(url, options = {}, { silent401 = false } = {}) {
    let res = await _send(url, options);
    if (res.status !== 401) return res;

    // Token mode can tell "never logged in" from "session expired": no token at
    // all means the former, which is an expected outcome for the caller (e.g.
    // /api/me on a public page), not a session worth bouncing. Cookie mode
    // cannot see its own credential, so it has to try the refresh either way.
    if (!_cookieMode() && !getToken()) return res;

    if (await _refresh()) {
        res = await _send(url, options);
        if (res.status !== 401) return res;
    }

    // On public pages a dead session just means "treat as logged out" —
    // bouncing to /login would break pages that never required auth.
    if (silent401) return res;
    logout();
    return null;
}

/* Client-side gate for pages that must not render before a session exists.
   Cookie mode has nothing to check — the credential is invisible to script —
   so the server's own redirect is the gate, and this is deliberately a no-op. */
export function guard() {
    if (_cookieMode()) return;
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
    // loginUrl falls back to configure()'s loginApi so an app that already set
    // its endpoints for the session layer does not have to repeat itself here.
    registerUrl: '/api/auth/register',
    configUrl:   '/api/auth/config',
    langFlags:   { en: '🇬🇧', de: '🇩🇪' },
};

export function initAuth(cfg, { t, getLang, setLang }) {
    const c = { loginUrl: _cfg.loginApi, ...DEFAULTS, ...cfg };

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
    // Token mode can see its own credential. Cookie mode cannot, so the server
    // is the one that redirects an already-signed-in visitor away from here.
    if (!_cookieMode() && localStorage.getItem('access_token')) {
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
    if ((c.mode ?? 'both') === 'both' && c.configUrl) {
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

    // ── Credential submit ─────────────────────────────────────────────────────
    /* One request shape for both transports. Token mode reads the tokens out of
       the JSON body; cookie mode expects the server to have set the cookie and
       may answer with no body at all, so the response is only parsed when there
       is something to parse. */
    async function _submit(url, payload) {
        const res = await fetch(url, {
            method:      'POST',
            headers:     { 'Content-Type': 'application/json' },
            body:        JSON.stringify(payload),
            credentials: _cookieMode() ? 'same-origin' : 'omit',
        });

        let data = null;
        const body = await res.text();
        if (body) { try { data = JSON.parse(body); } catch { data = { message: body.trim() }; } }

        if (!res.ok) return { ok: false, message: data?.message };
        if (!_cookieMode()) _setTokens(data.access_token, data.refresh_token);
        return { ok: true };
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
            const r = await _submit(c.loginUrl, { username, password });
            if (!r.ok) { showStatus('status-login', 'err', r.message || t('msg.login_failed')); return; }
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
            const r = await _submit(c.registerUrl, { username, password });
            if (!r.ok) { showStatus('status-reg', 'err', r.message || t('msg.registration_failed')); return; }
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
