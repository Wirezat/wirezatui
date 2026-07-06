/* wirezat-ui-v1 / js/i18n.js
   Lightweight i18n engine: JSON locale loading + data-i18n DOM application.

   Usage:
     import { load, applyI18n, getLang, setLang, t } from '/static/ui/js/i18n.js';
     await load(getLang());
     applyI18n();

   Locale files are fetched from `/static/locales/<lang>.json` (flat key→string map).
   DOM hooks: data-i18n (textContent), data-i18n-placeholder, data-i18n-title.
*/

let _app  = {};
let _lang = localStorage.getItem('i18n_lang') || 'en';

export async function load(lang) {
  const base = '/static/locales/';
  const res = await fetch(base + lang + '.json').catch(() => null);
  _app  = (res && res.ok) ? await res.json() : {};
  _lang = lang;
  localStorage.setItem('i18n_lang', lang);
  document.documentElement.lang = lang === 'de' ? 'de' : 'en';
}

export function t(key, fallback) {
  return _app[key] ?? fallback ?? key;
}

export function setLang(lang) {
  localStorage.setItem('i18n_lang', lang);
  location.reload();
}

export function getLang() { return _lang; }

export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
}
