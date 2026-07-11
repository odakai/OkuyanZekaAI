/* ─── Okuyan Zeka AI · Core Module (by ODAK-AI) ─── */
(function () {

const STRINGS = {
  tr: {
    brand:'Okuyan Zeka AI', logout:'Çıkış Yap', settings:'Ayarlar',
    saveSettings:'Kaydet', settingsSaved:'Ayarlar kaydedildi',
    errorGeneral:'Bir hata oluştu: ', errorNoAI:'AI yapılandırması eksik. Ayarlardan API anahtarı girin.',
    loading:'Yükleniyor…', cancel:'İptal', close:'Kapat',
    confirm:'Onayla', save:'Kaydet', back:'Geri', next:'İleri', submit:'Gönder',
    langTr:'TR', langEn:'EN',
  },
  en: {
    brand:'Okuyan Zeka AI', logout:'Log Out', settings:'Settings',
    saveSettings:'Save', settingsSaved:'Settings saved',
    errorGeneral:'An error occurred: ', errorNoAI:'AI not configured. Enter an API key in Settings.',
    loading:'Loading…', cancel:'Cancel', close:'Close',
    confirm:'Confirm', save:'Save', back:'Back', next:'Next', submit:'Submit',
    langTr:'TR', langEn:'EN',
  }
};

// ── Language Manager ──
const Lang = (function () {
  let current = localStorage.getItem('odak_lang') || 'tr';

  function get() { return current; }

  function set(lang) {
    current = lang;
    localStorage.setItem('odak_lang', lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === lang);
    });
  }

  // Merkezi çeviri — sayfa kendi string tablosunu geçirir
  function t(strings, key, ...args) {
    const val = (strings[current] || strings['tr'])[key];
    return typeof val === 'function' ? val(...args) : (val !== undefined ? val : key);
  }

  // Sayfadaki tüm data-i18n elementlerini güncelle
  // strings formatı: {tr:{key:val}, en:{key:val}} veya doğrudan {key:val}
  function applyAll(strings) {
    // TX formatını normalize et
    const table = (strings[current] || strings['tr'] || strings) || {};
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const val = table[key];
      if (val === undefined || typeof val === 'function') return;
      if (el.dataset.i18nAttr) el.setAttribute(el.dataset.i18nAttr, val);
      else if (val.includes && val.includes('<')) el.innerHTML = val;
      else el.textContent = val;
    });
  }

  function init() {
    document.documentElement.lang = current;
    document.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === current);
      b.addEventListener('click', () => {
        set(b.dataset.lang);
        window.dispatchEvent(new CustomEvent('odak:lang:change', { detail: b.dataset.lang }));
      });
    });
  }

  return { get, set, t, applyAll, init };
})();

// ── Toast ──
function showToast(msg, type) {
  type = type || '';
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

// ── Theme Manager ──
const Theme = {
  themes: ['default', 'light', 'forest', 'sunset'],
  current() { return localStorage.getItem('odak_theme') || 'default'; },
  isDark() { const t = this.current(); return t !== 'light'; },
  apply(name) {
    if (name === 'default') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', name);
    localStorage.setItem('odak_theme', name);
    this._updateIcon();
  },
  toggle() { this.apply(this.isDark() ? 'light' : 'default'); },
  _updateIcon() {
    document.querySelectorAll('.theme-toggle').forEach(b => {
      b.textContent = this.isDark() ? '☀️' : '🌙';
    });
  },
  init() {
    this.apply(this.current());
    document.querySelectorAll('.theme-toggle').forEach(b => {
      b.addEventListener('click', () => this.toggle());
    });
  }
};

// ── AI Caller ──
async function callAI(prompt, settings) {
  const { aiProvider, apiKey } = settings || {};
  if (!apiKey) throw new Error('no_api_key');

  if (!aiProvider || aiProvider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.7 })
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    return (await res.json()).choices[0].message.content;
  }

  if (aiProvider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    return (await res.json()).candidates[0].content.parts[0].text;
  }

  if (aiProvider === 'nvidia') {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'meta/llama-3.1-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1024
      })
    });
    if (!res.ok) throw new Error(`NVIDIA ${res.status}`);
    return (await res.json()).choices[0].message.content;
  }

  throw new Error('Bilinmeyen AI sağlayıcı');
}

// ── Firebase bekleme ──
function waitForFirebase() {
  return new Promise(resolve => {
    if (window.OdakFirebase) return resolve(window.OdakFirebase);
    window.addEventListener('odak:firebase:ready', () => resolve(window.OdakFirebase), { once: true });
  });
}

// ── Auth guard ──
async function requireAuth(redirectTo) {
  redirectTo = redirectTo || '/auth/';
  const fb = await waitForFirebase();
  return new Promise(resolve => {
    fb.Auth.onAuthChange(user => {
      if (!user) window.location.href = redirectTo;
      else resolve(user);
    });
  });
}

// ── 6-haneli kod üretici ──
function generateChildCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── JSON parse helper (markdown temizler) ──
function parseJSON(raw) {
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

window.OdakApp = { Lang, showToast, Theme, callAI, waitForFirebase, requireAuth, generateChildCode, parseJSON, STRINGS };
window.dispatchEvent(new Event('odak:app:ready'));

})();
