// DnD Companion — Telegram Mini App
import * as R from './shared/rules.js';
import { CATALOG, BASE_WEAPONS } from './data/items.js';
import { featureDetails, resourceDetails } from './shared/details.js';
import { ABBR, ABBR_RE, diceInfo, SKILL_INFO } from './shared/glossary.js';
import { compile, translate, hasCyr, LANGS, LOCALES, normLang, langFromTg, ABBR_LOC } from './shared/i18n.js';

const tg = window.Telegram && window.Telegram.WebApp;
const CFG = window.DND_CONFIG || {};
const API = String(CFG.API_URL || '').replace(/\/+$/, '');
const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');
const $toast = document.getElementById('toast');
const $busy = document.getElementById('busy');

const S = {
  me: null, nav: [], room: null, modal: null, tab: 'sheet', mtab: 'room', rollLimit: 50, rollFilter: 0, seenRoll: {},
  wiz: null, newRoom: { name: '', pick: false, max: 5 }, edit: null, cat: { q: '', group: 'all', rarity: 'all' }, myItems: null, myEffects: null, log: null, logAll: false, bootError: null,
};

// ================= Допоміжні =================
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fm = R.fmtMod;
const clone = (o) => JSON.parse(JSON.stringify(o));
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const haptic = (t = 'success') => { try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred(t); } catch (e) { /* */ } };
const tapFx = () => { try { tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred('light'); } catch (e) { /* */ } };

const CLASS_ICON = { barbarian: '🪓', bard: '🎻', cleric: '⛪', druid: '🌿', fighter: '⚔️', monk: '👊', paladin: '🛡️', ranger: '🏹', rogue: '🗡️', sorcerer: '🔥', warlock: '👁️', wizard: '🧙' };
const ITEM_ICON = { weapon: '⚔️', armor: '🥋', shield: '🛡️', ammo: '🏹', gear: '🎒', tool: '🔧', potion: '🧪', ring: '💍', rod: '🪄', staff: '🦯', wand: '🪄', scroll: '📜', wondrous: '✨', food: '🍖', treasure: '💎', other: '📦' };
const raceName = (s) => (s.raceId === 'custom' ? (s.raceName || 'Інша раса') : (R.RACES[s.raceId] ? R.RACES[s.raceId].name : '—'));
const className = (s) => (R.CLASSES[s.classId] ? R.CLASSES[s.classId].name : '—');
const bgName = (s) => (R.BACKGROUNDS[s.backgroundId] ? R.BACKGROUNDS[s.backgroundId].name : '—');
const nowSec = () => Math.floor(Date.now() / 1000);
// Для старих предметів без шкоди беремо базову зброю з каталогу
function withBase(d) {
  if (d && d.type === 'weapon' && !d.damage && d.catalogId) {
    const c = CATALOG.find((x) => x.catalogId === d.catalogId);
    if (c && c.damage) return { ...d, damage: c.damage, dmgType: c.dmgType, props: d.props || c.props, ranged: c.ranged };
  }
  return d;
}
// ================= Мова інтерфейсу =================
// Вихідні тексти українською; для RU/EN словник перекладає їх (див. shared/i18n.js).
let LANG = 'uk';
let D = null;
const t = (s) => (D ? translate(D, s) : s);
const LS_LANG = 'dnd_lang';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* */ } };
const NO_AUTO = new Set(['Speed', 'Extra']);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let abbrRe = ABBR_RE;
let abbrBack = null;
let compRe = /(?<![\p{L}])([ВСМ])(?![\p{L}])/gu;
const abLoc = (k) => (ABBR_LOC[LANG] && ABBR_LOC[LANG][k]) || k;
function setupAbbr() {
  if (LANG === 'uk') { abbrRe = ABBR_RE; abbrBack = null; compRe = /(?<![\p{L}])([ВСМ])(?![\p{L}])/gu; return; }
  const loc = ABBR_LOC[LANG];
  abbrBack = new Map(Object.keys(ABBR).map((k) => [loc[k] || k, k]));
  const auto = [...abbrBack.keys()].filter((v) => v.length > 1 && !NO_AUTO.has(v)).sort((a, b) => b.length - a.length);
  const d = LANG === 'en' ? 'd' : 'к';
  abbrRe = new RegExp(`(?<![\\p{L}\\p{N}])(\\d*${d}(?:100|20|12|10|8|6|4)(?![\\p{L}\\p{N}])|${auto.map(escRe).join('|')})(?![\\p{L}])`, 'gu');
  compRe = new RegExp(`(?<![\\p{L}])([${loc['В']}${loc['С']}${loc['М']}])(?![\\p{L}])`, 'gu');
}
// показане скорочення → ключ глосарію (кістки — у вигляді «2к6»)
const abKey = (m) => (abbrBack ? (abbrBack.get(m) || m.replace(/^(\d*)d(?=\d)/, '$1к')) : m);
async function applyLang(lang) {
  lang = normLang(lang);
  let dict = null;
  if (lang !== 'uk') dict = compile((await import(`./i18n/${lang}.js`)).default, lang);
  D = dict;
  LANG = lang;
  document.documentElement.lang = lang;
  if (D && window.DND_I18N_DEBUG) { D.missing = new Set(); D.hits = new Set(); window.DND_I18N = D; }
  setupAbbr();
  R.setNameOrder(t, LOCALES[lang]);
}
// Переклад готового DOM: текстові вузли та підписи полів (крім [data-notr] і полів введення)
const seenText = new WeakSet();
function trText(n) {
  if (seenText.has(n)) return;
  seenText.add(n);
  const v = n.nodeValue;
  if (!hasCyr(v)) return;
  const r = translate(D, v);
  if (r !== v) n.nodeValue = r;
}
const TR_ATTRS = ['placeholder', 'title', 'aria-label'];
const seenAttr = new WeakSet();
function trAttrs(el) {
  if (seenAttr.has(el)) return;
  seenAttr.add(el);
  for (const a of TR_ATTRS) {
    const v = el.getAttribute(a);
    if (v && hasCyr(v)) el.setAttribute(a, translate(D, v));
  }
}
const noTr = (el) => el.hasAttribute('data-notr') || el.tagName === 'TEXTAREA' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE';
function trTree(root) {
  if (!D || !root) return;
  if (root.nodeType === 3) { if (!root.parentElement || !root.parentElement.closest('[data-notr],textarea')) trText(root); return; }
  if (root.nodeType !== 1 || root.closest('[data-notr],textarea')) return;
  trAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (n.nodeType !== 1) return NodeFilter.FILTER_ACCEPT;
      if (n.hasAttribute('data-notr')) return NodeFilter.FILTER_REJECT;
      trAttrs(n);
      return noTr(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
    },
  });
  const list = [];
  while (w.nextNode()) list.push(w.currentNode);
  list.forEach(trText);
}
new MutationObserver((recs) => {
  if (!D) return;
  for (const r of recs) for (const n of r.addedNodes) trTree(n);
}).observe(document.body, { childList: true, subtree: true });

// Скорочення: тапабельні з довідкою (data-k — український ключ глосарію)
const ab = (k, text) => `<span class="abbr" data-act="abbr" data-k="${esc(k)}" data-notr>${esc(text == null ? abLoc(k) : t(text))}</span>`;
const wrapNoTr = (h) => (D ? `<span data-notr>${h}</span>` : h);
const abbrify = (s) => wrapNoTr(esc(t(s)).replace(abbrRe, (m) => `<span class="abbr" data-act="abbr" data-k="${esc(abKey(m))}">${m}</span>`));
const compAbbr = (s) => wrapNoTr(esc(t(s)).replace(compRe, (m) => `<span class="abbr" data-act="abbr" data-k="${esc(abKey(m))}">${m}</span>`));
const LOGO = (cls = 'logo-img') => `<picture><source srcset="img/logo.webp" type="image/webp"><img class="${cls}" src="img/logo.png" alt="DnD Companion" width="512" height="512"></picture>`;
const SUPPORT_URL = 'https://send.monobank.ua/jar/8navh2xeC2';
const CONTACT_EMAIL = 'alzadnicenko@gmail.com';
const CONTACT_TG = 'Gregolar';
const footerHtml = () => `<footer class="foot">
  <a href="${SUPPORT_URL}" data-act="openExt" data-url="${SUPPORT_URL}">💙 Підтримати проект</a>
  <div class="foot-q">Питання та пропозиції:</div>
  <a href="mailto:${CONTACT_EMAIL}" data-act="mail" data-addr="${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> <span class="hint">(gmail)</span><br>
  <a href="https://t.me/${CONTACT_TG}" data-act="openTg" data-url="https://t.me/${CONTACT_TG}">@${CONTACT_TG}</a> <span class="hint">(телеграм)</span>
</footer>`;
const SRC_LABEL = { race: 'Раса', class: 'Клас', subclass: 'Підклас', choice: 'Вибір', feat: 'Риса', custom: 'Від майстра' };
const moneyStr = (m) => R.COINS.filter((k) => m && m[k]).map((k) => `${m[k]} ${R.COIN_NAMES[k]}`).join(', ') || '0';

let toastTimer = null;
function toast(msg, err = false) {
  $toast.textContent = msg;
  $toast.className = 'show' + (err ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $toast.className = err ? 'err' : ''; }, err ? 4200 : 2400);
}
// Підтвердження. Telegram показує текст до 256 символів (довший — помилка WebAppPopupParamInvalid),
// тож довгий текст або збій вікна Telegram — власне вікно застосунку
function confirmBox(msg) {
  msg = t(msg);
  if (tg && tg.showConfirm && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2') && msg.length <= 256) {
    return new Promise((res) => {
      try { tg.showConfirm(msg, (ok) => res(!!ok)); } catch (e) { inAppConfirm(msg).then(res); }
    });
  }
  return tg && tg.initData ? inAppConfirm(msg) : Promise.resolve(window.confirm(msg));
}
function inAppConfirm(msg) {
  return new Promise((res) => {
    const w = document.createElement('div');
    w.className = 'cbox-wrap';
    w.innerHTML = `<div class="cbox" role="dialog"><p data-notr>${esc(msg)}</p>
      <div class="btns"><button class="btn" data-c="0" data-notr>${esc(t('Скасувати'))}</button><button class="btn primary" data-c="1">OK</button></div></div>`;
    w.addEventListener('click', (e) => {
      const b = e.target.closest('[data-c]');
      if (!b && e.target !== w) return;
      e.stopPropagation();
      w.remove();
      res(!!b && b.dataset.c === '1');
    });
    document.body.appendChild(w);
  });
}
let busyN = 0;
function busy(on) { busyN += on ? 1 : -1; $busy.hidden = busyN <= 0; }

async function api(op, params = {}, opts = {}) {
  if (!API || API.includes('REPLACE')) throw new Error('Сервер ще не налаштований (config.js).');
  let r;
  try {
    r = await fetch(`${API}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Init-Data': (tg && tg.initData) || '' },
      body: JSON.stringify({ op, ...params }),
      signal: opts.signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw new Error('Немає зв’язку із сервером. Перевір інтернет.');
  }
  const data = await r.json().catch(() => ({ error: `Помилка сервера (${r.status})` }));
  if (!r.ok || data.error) throw new Error(data.message || data.error || 'Помилка');
  return data;
}
// Виконати дію з індикатором і обробкою помилок
async function run(fn, okMsg) {
  busy(true);
  try {
    const r = await fn();
    if (okMsg) toast(okMsg);
    haptic('success');
    return r === undefined ? true : r;
  } catch (e) {
    toast(e.message || String(e), true);
    haptic('error');
    return undefined;
  } finally { busy(false); }
}

// ================= Навігація =================
const cur = () => S.nav[S.nav.length - 1] || { view: 'loading' };
function go(view, params = {}) { hideTip(); S.nav.push({ view, ...params }); S.modal = null; render(); window.scrollTo(0, 0); }
function reset(...entries) { S.nav = entries.map((e) => (typeof e === 'string' ? { view: e } : e)); S.modal = null; render(); window.scrollTo(0, 0); }
function back() {
  if (S.modal) { closeModal(); return; }
  if (S.nav.length > 1) {
    S.nav.pop();
    render();
    window.scrollTo(0, 0);
    const v = cur().view;
    if (v === 'masterHome' || v === 'playerHome') loadMe(true);
    if (v === 'room' || v === 'char') loadRoom(true);
  }
}
function syncBackButton() {
  if (!tg || !tg.BackButton) return;
  if (S.nav.length > 1 || S.modal) tg.BackButton.show(); else tg.BackButton.hide();
}
function openModal(m) { S.modal = m; renderModal(); syncBackButton(); }
function closeModal() { hideTip(); S.modal = null; renderModal(); syncBackButton(); }

// ================= Дані =================
async function loadMe(silent) {
  try {
    S.me = await api('me');
    if (['masterHome', 'playerHome', 'role'].includes(cur().view)) render();
  } catch (e) { if (!silent) toast(e.message, true); }
}

async function loadRoom(silent) {
  const roomId = S.roomId;
  if (!roomId) return;
  try {
    // стрічку кидків майстер отримує лише з відкритою вкладкою 🎲
    const withRolls = S.mtab === 'dice' && S.room && S.room.role === 'master';
    const d = await api('room', withRolls ? { roomId, rolls: S.rollLimit } : { roomId });
    if (S.roomId !== roomId) return;
    const changed = JSON.stringify(d) !== JSON.stringify(S.room);
    S.room = d;
    if (!silent || changed) refreshScreen();
  } catch (e) {
    if (!silent) toast(e.message, true);
    if (/не знайдено|видалено|не в цій кімнаті/i.test(e.message)) {
      S.room = null; S.roomId = null;
      const home = S.me && S.me.user.role === 'master' ? 'masterHome' : 'playerHome';
      reset('role', home);
      loadMe(true);
    }
  }
}

// Перемальовує екран і відкрите вікно; якщо людина зараз щось вводить — відкладає до виходу з поля
function isTyping() {
  const a = document.activeElement;
  return !!(a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) && a.type !== 'checkbox' && a.type !== 'radio');
}
function refreshScreen() {
  if (isTyping()) { S.pendingRender = true; return; }
  S.pendingRender = false;
  const y = window.scrollY;
  render();
  if (S.modal) renderModal();
  window.scrollTo(0, y);
}
document.addEventListener('focusout', () => {
  if (!S.pendingRender) return;
  setTimeout(() => { if (S.pendingRender && !isTyping()) refreshScreen(); }, 400);
});

// Миттєве оновлення: сервер тримає запит, доки в кімнаті щось не зміниться
let watchGen = 0;
let watchRoom = null;
let watchAbort = null;
function stopWatch() { watchGen++; watchRoom = null; if (watchAbort) { watchAbort.abort(); watchAbort = null; } }
function syncWatch() {
  const inRoom = S.roomId && S.nav.some((v) => v.view === 'room');
  if (!inRoom) { if (watchRoom) stopWatch(); return; }
  if (watchRoom === S.roomId) return;
  stopWatch();
  const gen = watchGen;
  const roomId = S.roomId;
  watchRoom = roomId;
  (async () => {
    let fails = 0;
    while (gen === watchGen) {
      if (document.hidden) { await new Promise((r) => setTimeout(r, 1500)); continue; }
      const since = S.room && S.room.room.id === roomId ? (S.room.room.version || 0) : -1;
      watchAbort = new AbortController();
      try {
        const r = await api('watch', { roomId, since }, { signal: watchAbort.signal });
        fails = 0;
        if (gen !== watchGen) return;
        if (r.gone) { roomGone(); return; }
        if (r.version !== since) await loadRoom(true);
      } catch (e) {
        if (gen !== watchGen) return;
        fails++;
        await new Promise((r) => setTimeout(r, Math.min(15000, 1500 * fails)));
      }
    }
  })();
}

function roomGone() {
  const home = S.room && S.room.role === 'master' ? 'masterHome' : 'playerHome';
  S.room = null; S.roomId = null;
  reset('role', home);
  loadMe(true);
  toast('Кімната недоступна: її закрито або тебе з неї прибрали');
}

function openRoom(roomId) {
  S.roomId = roomId;
  if (!S.room || S.room.room.id !== roomId) { S.room = null; S.mtab = 'room'; S.rollFilter = 0; S.rollLimit = 50; }
  S.tab = 'sheet';
  go('room', { roomId });
  loadRoom();
}

const isRO = () => cur().view === 'archiveChar';
const isMaster = () => !isRO() && S.room && S.room.role === 'master';
function currentChar() {
  if (isRO()) return S.archive ? S.archive.character : null;
  if (!S.room) return null;
  if (S.room.role === 'player') return S.room.character;
  const id = cur().charId || (S.modal && S.modal.charId);
  const p = S.room.players.find((x) => x.character && x.character.id === id);
  return p ? p.character : null;
}
function charOwnerName(ch) {
  if (!S.room || S.room.role !== 'master') return '';
  const p = S.room.players.find((x) => x.userId === ch.userId);
  return p ? p.name : '';
}
function derived(ch) {
  const s = ch.sheet;
  return {
    prof: R.sheetProf(s),
    ac: R.computeAC(s, ch.items || []),
    init: R.mod(s.abilities.dex) + num(s.initBonus),
    pp: R.passivePerception(s),
    slots: R.sheetSlots(s),
  };
}

// ================= Рендер =================
// Клас персонажа на екрані — для кольорової теми й емблеми
function viewClass(v) {
  const ch = v.view === 'room' ? (S.room && S.room.role !== 'master' && S.room.character)
    : v.view === 'char' ? currentChar() : v.view === 'archiveChar' ? (S.archive && S.archive.character) : null;
  return ch && ch.sheet && R.CLASSES[ch.sheet.classId] ? ch.sheet : null;
}
// архетип, для якого є власна емблема й палітра: «клас-підклас»
const subKey = (classId, subId) => (subId && R.CLASS_DATA[classId] && R.CLASS_DATA[classId].subclasses[subId] ? `${classId}-${subId}` : '');
const clsAttrs = (classId, subId) => `data-cls="${esc(classId || '')}"${subKey(classId, subId) ? ` data-sub="${subKey(classId, subId)}"` : ''}`;
function render() {
  const v = cur();
  const fn = VIEWS[v.view] || VIEWS.loading;
  const vs = viewClass(v);
  const sub = vs ? subKey(vs.classId, vs.subclassId) : '';
  if (vs) document.body.dataset.cls = vs.classId; else delete document.body.dataset.cls;
  if (sub) document.body.dataset.sub = sub; else delete document.body.dataset.sub;
  $app.innerHTML = fn(v);
  syncBackButton();
  syncWatch();
}
function renderModal() {
  if (!S.modal) { $modal.innerHTML = ''; return; }
  const fn = MODALS[S.modal.type];
  const html = fn ? fn(S.modal) : '';
  if (html === null) { S.modal = null; $modal.innerHTML = ''; syncBackButton(); return; }
  const prev = $modal.querySelector('.sheet');
  if (prev) {
    // вікно вже відкрите — оновлюємо лише вміст, без повторної анімації
    const scroll = prev.scrollTop;
    prev.innerHTML = `<div class="grab"></div>${html}`;
    prev.scrollTop = scroll;
  } else {
    $modal.innerHTML = `<div class="overlay"><div class="sheet"><div class="grab"></div>${html}</div></div>`;
  }
}
const loadingHtml = () => '<div class="center-screen"><div class="spinner"></div></div>';
const empty = (e, t) => `<div class="empty"><span class="e">${e}</span>${t}</div>`;
const hpClass = (s) => { const p = s.hp.max ? s.hp.cur / s.hp.max : 0; return p <= 0.25 ? 'low' : p <= 0.5 ? 'mid' : ''; };
const hdr = (title, sub) => `<div class="hdr"><div><h3>${title}</h3>${sub ? `<small>${sub}</small>` : ''}</div><button class="x" data-act="closeModal">✕</button></div>`;

function archiveBadge(a) {
  if (a.status === 'active') return '<span class="badge green">у грі</span>';
  if (a.dead) return `<span class="badge red">☠ загинув</span>${a.roomClosed ? ' <span class="badge">кімнату закрито</span>' : ''}`;
  if (a.status === 'closed') return '<span class="badge">кімнату закрито</span>';
  return '<span class="badge">покинув кімнату</span>';
}
function archiveHtml() {
  const list = (S.me && S.me.archive) || [];
  return `<details class="card archive" ${S.archiveOpen ? 'open' : ''}><summary><b>📚 Архів персонажів</b> <span class="badge">${list.length}</span></summary>
    ${list.length ? list.map((a) => `<div class="list-item tapline" data-act="openArchive" data-id="${a.id}" ${clsAttrs(a.classId, a.subclassId)} style="padding:10px 0;border-top:1px solid var(--line)">
      <div class="ava">${a.dead ? '💀' : CLASS_ICON[a.classId] || '🧝'}</div>
      <div class="meta"><b>${esc(a.name)}</b><small>${esc(a.raceId === 'custom' ? a.raceName : (R.RACES[a.raceId] || {}).name || '')} · ${esc((R.CLASSES[a.classId] || {}).name || '')} ${a.level} рів.${a.subclass ? ` · ${esc(a.subclass)}` : ''}</small>
      <small>🏰 ${esc(a.roomName)}</small>${archiveBadge(a)}</div><span class="chev">›</span></div>`).join('')
    : '<p class="hint">Тут зберігатимуться всі твої персонажі з усіх кімнат — на пам’ять.</p>'}</details>`;
}

const VIEWS = {
  loading: loadingHtml,

  noTelegram: () => `<div class="center-screen">${LOGO('logo-img sm')}
    <p class="hint">Цей застосунок працює всередині Telegram. Відкрий бота й натисни «🎲 Грати».</p>
    <a class="btn primary" href="https://t.me/${esc(CFG.BOT_USERNAME || '')}">Відкрити @${esc(CFG.BOT_USERNAME || 'бота')}</a></div>`,

  error: () => `<div class="center-screen"><div style="font-size:54px">🧌</div><h3>Щось пішло не так</h3>
    <p class="hint">${esc(S.bootError || '')}</p><button class="btn primary" data-act="retry">Спробувати ще</button></div>`,

  role: () => {
    const u = S.me.user;
    return `<div class="lang-bar"><div class="lang-sw" role="group" aria-label="${esc(t('Мова'))}" data-notr>${LANGS.map(([id, label]) => `<button class="${id === LANG ? 'on' : ''}" data-act="setLang" data-v="${id}" aria-pressed="${id === LANG}">${label}</button>`).join('')}</div></div>
    <div class="hero">${LOGO()}<p class="hint">Привіт, ${esc(u.name)}! Обери, ким ти будеш.</p></div>
    <div class="role-cards">
      <button class="role-card ${u.role === 'master' ? 'active' : ''}" data-act="pickRole" data-role="master"><span class="ic">🧙</span>
        <span><b>Майстер</b><small>Створюй кімнати, видавай предмети, керуй персонажами гравців</small></span></button>
      <button class="role-card ${u.role === 'player' ? 'active' : ''}" data-act="pickRole" data-role="player"><span class="ic">⚔️</span>
        <span><b>Гравець</b><small>Приєднуйся до кімнати й веди свого персонажа</small></span></button>
    </div>${footerHtml()}`;
  },

  masterHome: () => {
    const rooms = S.me.masterRooms;
    return `<div class="top"><h2>🧙 Майстер</h2><button class="link" data-act="switchRole">Змінити роль</button></div>
    <div class="card"><h3>Створити кімнату</h3>
      <p class="hint">Кімната — це твоя гра або кампанія. До ${S.me.maxPlayers} гравців.</p>
      <div class="row mt"><input id="newRoomName" class="grow" data-bind="newRoom.name" value="${esc(S.newRoom.name)}" maxlength="60" placeholder="Назва, напр. «Копальні Фанделвера»">
      <button class="btn primary" data-act="createRoom">Створити</button></div>
      ${startLevelHtml('newRoom.pick', S.newRoom.pick, 'newRoom.max', S.newRoom.max, '')}</div>
    <div class="card tap list-item" data-act="openMyCatalog"><div class="ava">📦</div><div class="meta"><b>Каталог</b>
      <small>Предмети й ефекти D&D 5e і твої власні — спільні для всіх твоїх кімнат</small></div><span class="chev">›</span></div>
    <h3 class="sec">Мої кімнати</h3>
    ${rooms.length ? rooms.map((r) => `<div class="card tap list-item" data-act="openRoom" data-id="${esc(r.id)}">
      <div class="ava">🏰</div><div class="meta"><b>${esc(r.name)}</b><small>Код ${esc(r.id)} · гравців ${r.players}/${S.me.maxPlayers} · сесія ${r.session}</small></div><span class="chev">›</span></div>`).join('')
    : empty('🏰', 'Ще немає кімнат. Створи першу вище.')}${footerHtml()}`;
  },

  playerHome: () => {
    const rooms = S.me.playerRooms;
    return `<div class="top"><h2>⚔️ Гравець</h2><button class="link" data-act="switchRole">Змінити роль</button></div>
    <div class="card"><h3>Приєднатися до кімнати</h3>
      <p class="hint">Введи код, який дав майстер, або відкрий його посилання-запрошення.</p>
      <div class="row mt"><input id="joinCode" class="grow code" style="font-size:18px" maxlength="10" placeholder="КОД" autocapitalize="characters">
      <button class="btn primary" data-act="joinByCode">Увійти</button></div></div>
    ${archiveHtml()}
    <h3 class="sec">Мої кімнати</h3>
    ${rooms.length ? rooms.map((r) => `<div class="card tap list-item" data-act="openRoom" data-id="${esc(r.id)}">
      <div class="ava">${r.character ? (CLASS_ICON[r.character.classId] || '🧝') : '🎲'}</div>
      <div class="meta"><b>${esc(r.name)}</b><small>${r.character ? `${esc(r.character.name)} · ${esc(R.CLASSES[r.character.classId] ? R.CLASSES[r.character.classId].name : '')} ${r.character.level} рів.` : 'Персонаж не створений'} · майстер ${esc(r.masterName || '')}</small>
      ${r.character && r.character.pendingLevel ? '<span class="badge gold">⬆️ новий рівень</span>' : ''}</div><span class="chev">›</span></div>`).join('')
    : empty('🗝️', 'Ти ще не в жодній кімнаті.')}${footerHtml()}`;
  },

  join: (v) => `<div class="center-screen"><div style="font-size:60px">📜</div><h2>Запрошення до гри</h2>
    <p class="hint">Код кімнати</p><div class="code">${esc(v.code)}</div>
    <button class="btn primary block mt" data-act="joinInvite" data-code="${esc(v.code)}">⚔️ Приєднатися як гравець</button>
    <button class="btn block" data-act="switchRole">Скасувати</button></div>`,

  room: () => {
    const d = S.room;
    if (!d) return loadingHtml();
    if (d.role === 'master') return masterRoomHtml(d);
    if (!d.character) return eventBanner(d) + playerNoCharHtml(d);
    return eventBanner(d) + charHtml(d.character, false);
  },

  char: () => {
    const ch = currentChar();
    if (!S.room) return loadingHtml();
    if (!ch) return empty('❔', 'Персонажа не знайдено. Можливо, він загинув або гравця видалено.');
    return charHtml(ch, true);
  },

  create: () => createHtml(),
  archiveChar: () => (S.archive ? charHtml(S.archive.character, false) : loadingHtml()),
  catalog: () => catalogHtml(),
  editSheet: () => editSheetHtml(),
  spellPick: () => {
    const ch = currentChar();
    if (!ch || !S.pick) return loadingHtml();
    return `<div class="top"><h2>📖 Закляття</h2><small class="hint">${esc(ch.sheet.name)} · ${esc(className(ch.sheet))} ${ch.sheet.level} рів.</small></div>
      ${spellPickerHtml()}<div class="btns mt2"><button class="btn primary block" data-act="spSave">💾 Зберегти</button></div>`;
  },
  log: () => logHtml(),
};

// ---------- Події (бій, дослідження…) ----------
const evType = (t) => R.EVENT_TYPES[t] || R.EVENT_TYPES.other;
const evMins = (ev) => Math.max(0, Math.round((Date.now() / 1000 - ev.startedAt) / 60));
const findEv = (id) => ((S.room && S.room.room.events) || []).find((e) => e.id === Number(id));
// Плашка для гравців під час події
function eventBanner(d) {
  const ev = d.room && d.room.event;
  if (!ev) return '';
  const [tn, ti] = evType(ev.type);
  return `<div class="ev-banner">${ti} <span>Йде подія:</span> <b>${esc(ev.name)}</b> <small>· ${tn}</small></div>`;
}
// ---------- Ефекти (стани) ----------
const FX_FORMS = {
  uk: { round: ['раунд', 'раунди', 'раундів'], min: ['хвилина', 'хвилини', 'хвилин'], hour: ['година', 'години', 'годин'], day: ['день', 'дні', 'днів'] },
  ru: { round: ['раунд', 'раунда', 'раундов'], min: ['минута', 'минуты', 'минут'], hour: ['час', 'часа', 'часов'], day: ['день', 'дня', 'дней'] },
  en: { round: ['round', 'rounds'], min: ['minute', 'minutes'], hour: ['hour', 'hours'], day: ['day', 'days'] },
};
const FX_UNIT_NAMES = [['round', 'Раунди'], ['min', 'Хвилини'], ['hour', 'Години'], ['day', 'Дні'], ['perm', 'До зняття']];
const FX_ICONS = ['✨', '🔥', '❄️', '⚡', '☠️', '🩸', '💀', '🌀', '🛡️', '🎯', '😵', '🌑', '💚', '🕸️', '🍄', '👁️', '🧪', '🪄'];
// скільки лишилось — уже мовою інтерфейсу (з правильною формою множини)
function fxLeft(e) {
  if (e.unit === 'perm') return t('до зняття');
  if (e.unit === 'lvl') return t(`рівень ${e.n}`);
  const f = (FX_FORMS[LANG] || FX_FORMS.uk)[e.unit] || FX_FORMS.uk.round;
  if (LANG === 'en') return `${e.n} ${f[e.n === 1 ? 0 : 1]}`;
  const a = e.n % 10;
  const b = e.n % 100;
  return `${e.n} ${f[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 1 : 2]}`;
}
const fxDef = (e) => (e.key && R.EFFECTS[e.key]) || null;
const fxView = (e) => { const d = fxDef(e); return d ? { ...d, std: true } : { g: 'custom', icon: e.icon, name: e.name, desc: e.desc, std: false }; };
// Ефекти під рядком КЗ · Хіти · Ініціатива…: у гравця — назва й скільки лишилось, у майстра — ще − / + і «Додати статус»
function effectsBlock(ch, M, RO) {
  const fx = ch.effects || [];
  const ctl = M && !RO;
  if (!fx.length && !ctl) return '';
  return `<div class="fx-row">${fx.map((e) => {
    const d = fxView(e);
    const perm = e.unit === 'perm';
    return `<div class="fx fx-${d.g}" data-act="fxInfo" data-id="${e.id}"><span class="fx-i">${esc(d.icon)}</span><span class="fx-n"${d.std ? '' : ' data-notr'}>${esc(d.name)}</span>
      ${ctl && !perm ? `<button class="fx-b" data-act="fxStep" data-id="${e.id}" data-d="-1" aria-label="${esc(t('Менше'))}">−</button>` : ''}<span class="fx-left" data-notr>${esc(fxLeft(e))}</span>${ctl && !perm ? `<button class="fx-b" data-act="fxStep" data-id="${e.id}" data-d="1" aria-label="${esc(t('Більше'))}">+</button>` : ''}${ctl && perm ? `<button class="fx-b x" data-act="fxRemove" data-id="${e.id}" aria-label="${esc(t('Зняти статус'))}">✕</button>` : ''}</div>`;
  }).join('')}${ctl ? '<button class="fx-add" data-act="fxAddModal">＋ Додати статус</button>' : ''}</div>`;
}
// Підказки у вкладці кидків: як ефекти впливають на обраний кидок
function fxHints(ch, purpose) {
  const fr = R.effectRoll(ch.effects, purpose);
  if (!fr.hints.length) return '';
  return `<div class="fx-hints">${fr.hints.map((x) => `<div><span>${x.icon}</span> <span>${esc(x.name)}</span> → <b>${x.mode === 'adv' ? '<span>перевага</span>' : x.mode === 'dis' ? '<span>перешкода</span>' : x.mode === 'fail' ? '<span>автоматичний провал</span>' : `<span>${esc(x.note)}</span>`}</b></div>`).join('')}
    ${fr.cancel ? '<div class="hint">Перевага й перешкода взаємно скасовуються</div>' : ''}</div>`;
}

// Позначки майстра для кидка: атака й шкода — попадання / промах, решта — успіх / провал
const HIT_KINDS = ['attack', 'spellattack', 'damage'];
const markNames = (r) => (HIT_KINDS.includes(r.kind) ? ['Попадання', 'Промах'] : ['Успіх', 'Провал']);
function markBtns(r, compact) {
  // шкода позначок не має: попадання відмічається на кидку атаки, шкода рахується завжди
  if (r.kind === 'damage') return compact ? '' : '<span class="grow"></span>';
  const [ok, no] = markNames(r);
  const b = (cls, m, sym, name) => `<button class="ev-mk ${cls}${r.mark === m ? ' on' : ''}" data-act="rollMark" data-id="${r.id}" data-m="${r.mark === m ? 0 : m}"
    aria-label="${esc(t(name))}" title="${esc(t(name))}">${sym}${compact ? '' : ` <span>${name}</span>`}</button>`;
  return `<div class="ev-marks${compact ? '' : ' wide'}">${b('ok', 2, '✓', ok)}${b('fail', 1, '✗', no)}</div>`;
}
// Позначка біля кидка в історії гравця
const markChip = (r) => (r.mark ? `<small class="mk ${r.mark === 2 ? 'ok' : 'fail'}">${r.mark === 2 ? '✓' : '✗'} <span>${markNames(r)[r.mark === 2 ? 0 : 1]}</span></small>` : '');
// Стрічка кидків гравців для майстра (вкладка 🎲 у кімнаті)
function rollFeed(d) {
  const all = d.room.rolls;
  if (!all) return '<div class="spinner" style="margin:30px auto"></div>';
  const chars = roomChars(d);
  const f = S.rollFilter;
  const list = f ? all.filter((r) => r.charId === f) : all;
  let h = `<p class="hint roll-hint">Кидки гравців цієї сесії. Познач ✓ / ✗ — гравець побачить позначку, вона потрапить і у звіт події. 🗑 — видалити кидок звідусіль.</p>`;
  if (chars.length > 1) {
    h += `<div class="chips wrap">${[[0, 'Усі']].concat(chars.map((ch) => [ch.id, ch.sheet.name]))
      .map(([id, n]) => `<button class="chip ${f === id ? 'on' : ''}" data-act="rollFilter" data-id="${id}"${id ? ' data-notr' : ''}>${esc(n)}</button>`).join('')}</div>`;
  }
  if (!list.length) return h + empty('🎲', 'Кидків поки немає');
  h += list.map((r) => {
    const ei = r.ev ? evType(r.ev.type)[1] : '';
    return `<div class="card roll-c${r.kind === 'damage' && r.mark === 1 ? ' miss' : ''}" data-roll="${r.id}" ${clsAttrs(r.classId, r.subclassId)}>
      <div class="row roll-who"><div class="ava sm">${CLASS_ICON[r.classId] || '🧝'}</div><div class="grow"><b data-notr>${esc(r.charName)}</b>
        <small class="hint"><span data-notr>${esc(r.player)}</span> · ${fmtTime(r.ts)}</small></div>
        <b class="roll-v${r.crit === 20 ? ' c20' : r.crit === 1 ? ' c1' : ''}">${r.total}</b></div>
      <div class="roll-what">${esc(r.label)}${r.mode ? ` <small class="hint">· ${r.mode === 'adv' ? 'з перевагою' : 'з перешкодою'}</small>` : ''}
        ${r.ev ? `<span class="badge red ev-tag">${ei} <span data-notr>${esc(r.ev.name)}</span></span>` : ''}</div>
      <small class="hint dice-bd">${rollBreakdown(r)}</small>
      ${r.crit === 20 ? '<span class="badge gold">природна 20!</span>' : r.crit === 1 ? '<span class="badge red">природна 1</span>' : ''}
      <div class="row roll-acts">${markBtns(r)}<button class="btn sm danger roll-del" data-act="rollDel" data-id="${r.id}" aria-label="${esc(t('Видалити кидок'))}">🗑</button></div></div>`;
  }).join('');
  if (all.length >= S.rollLimit) h += '<button class="btn block mt" data-act="rollMore">Показати ще</button>';
  return h;
}

// Персонажі кімнати (живі) та подія, в якій кожен зараз
const roomChars = (d) => d.players.filter((p) => p.character).map((p) => p.character);
const charEvent = (d, id) => (d.room.events || []).find((e) => e.members.includes(id));
// Вибір учасників події (галочки); evId — подія, яку редагуємо
function evCharPicks(d, evId, sel) {
  const chars = roomChars(d);
  if (!chars.length) return '<p class="hint">Персонажів у кімнаті ще немає</p>';
  return `<div class="ev-picks">${chars.map((ch) => {
    const other = charEvent(d, ch.id);
    const busy = other && other.id !== evId;
    return `<label class="row ev-pick"><input type="checkbox" data-arr="modal.chars" data-v="${ch.id}" ${sel.includes(String(ch.id)) ? 'checked' : ''}>
      <span class="grow">${esc(ch.sheet.name)}</span>${busy ? `<small class="hint">у події «${esc(other.name)}»</small>` : ''}</label>`;
  }).join('')}</div>`;
}
// Картка однієї події: живі підсумки, поправки, позначки кидків
function eventCard(d, ev, many) {
  const [tn, ti] = evType(ev.type);
  const chars = ev.chars || [];
  const rolls = ev.rolls || [];
  const combat = ev.type === 'combat';
  const open = !!(S.evRolls && S.evRolls[ev.id]);
  // у бою завжди видно шкоду; в інших подіях — лише якщо вона була
  const chip = (icon, v, always) => (v || always ? `<span class="ev-st">${icon} ${v}</span>` : '');
  return `<div class="card ev-card" data-ev="${ev.id}"><div class="row"><div class="grow"><b class="ev-name">${ti} ${esc(ev.name)}</b>
    <small class="hint">${tn} · триває ${evMins(ev)} хв</small></div><span class="ev-live">● запис</span></div>
    <div class="ev-legend hint">⚔️ завдав шкоди · 🩸 отримав · 💚 лікування · 🎲 кидки · 📌 інші дії</div>
    ${chars.length ? chars.map((x) => `<div class="ln ev-ch"><span class="grow">${esc(x.name)}</span>
      ${chip('⚔️', x.dealt, combat)}${chip('🩸', x.taken, combat)}${chip('💚', x.heal, false)}${chip('🎲', x.rolls, true)}${chip('📌', x.acts, false)}
      ${combat || x.dealt ? `<button class="btn sm" data-act="eventAdjModal" data-id="${x.charId}" data-name="${esc(x.name)}">± шкода</button>` : ''}</div>`).join('')
    : '<div class="ln hint">Учасників немає</div>'}
    ${rolls.length ? `<button class="link mt" data-act="eventRolls" data-id="${ev.id}">${open ? '▾' : '▸'} Кидки події (${rolls.length})</button>
    ${open ? `<div class="hint ev-legend">Познач ✓ попадання / успіх чи ✗ промах / провал — це буде у звіті.</div>
    ${rolls.map((r) => `<div class="ln ev-roll${r.kind === 'damage' && r.mark === 1 ? ' miss' : ''}"><span class="grow">${esc(r.name)} · <span>${esc(r.label)}</span></span>
      <b class="v${r.crit === 20 ? ' c20' : r.crit === 1 ? ' c1' : ''}">${r.total}</b>${markBtns(r, true)}</div>`).join('')}` : ''}` : ''}
    <div class="btns mt"><button class="btn sm" data-act="eventMembersModal" data-id="${ev.id}">👥 Учасники</button>
      ${many ? `<button class="btn sm" data-act="eventMergeModal" data-id="${ev.id}">🔗 Об’єднати</button>` : ''}</div>
    <button class="btn primary block mt" data-act="eventEnd" data-id="${ev.id}">🏁 Завершити подію</button></div>`;
}
// Панель майстра: активні події (можуть іти паралельно) + хто зараз поза подіями
function eventPanel(d) {
  const evs = d.room.events || [];
  const free = roomChars(d).filter((ch) => !charEvent(d, ch.id));
  return `${evs.map((ev) => eventCard(d, ev, evs.length > 1)).join('')}
    ${evs.length && free.length ? `<div class="hint ev-free">🚶 Поза подією: ${free.map((ch) => `<b>${esc(ch.sheet.name)}</b>`).join(', ')}</div>` : ''}
    <button class="btn block ev-start" data-act="eventStartModal">${evs.length ? '⚔️ Ще одна подія' : '⚔️ Початок події'}</button>`;
}

// ---------- Кімната майстра ----------
function masterRoomHtml(d) {
  const r = d.room;
  const players = d.players;
  return `<div class="top"><h2>${esc(r.name)}</h2><button class="link" data-act="roomSettings">⚙️ Налаштування</button></div>
  <div class="card"><div class="row"><div class="grow"><small>Код кімнати</small><div class="code">${esc(r.id)}</div></div>
    <button class="btn primary" data-act="invite">📨 Запросити</button></div>
    <small class="hint">Сесія ${r.session} · гравців ${players.length}/${d.maxPlayers}</small></div>
  ${masterTabs(d)}
  ${S.mtab === 'dice' ? rollFeed(d) : `${eventPanel(d)}
  <div class="btns"><button class="btn" data-act="openLog">📜 Журнал</button><button class="btn" data-act="endSession">🏁 Завершити сесію</button></div>
  <div class="btns"><button class="btn sm" data-act="restAll" data-kind="short">☕ Короткий відпочинок для всіх</button><button class="btn sm" data-act="restAll" data-kind="long">🌙 Довгий для всіх</button></div>
  <h3 class="sec">Гравці</h3>
  ${players.length ? players.map(playerCard).join('') : empty('🕯️', 'Поки нікого. Надішли гравцям запрошення.')}
  ${d.fallen.length ? `<details class="mt"><summary>☠ Загиблі персонажі (${d.fallen.length})</summary>
    ${d.fallen.map((f) => `<div class="card list-item"><div class="ava">💀</div><div class="meta"><b>${esc(f.name)}</b>
    <small>${esc(R.CLASSES[f.classId] ? R.CLASSES[f.classId].name : '')} ${f.level} рів.</small></div>
    <button class="btn sm" data-act="revive" data-id="${f.id}">✨ Воскресити</button></div>`).join('')}</details>` : ''}`}`;
}
// Вкладки кімнати майстра: «Кімната» і 🎲 (кидки гравців; крапка — є нові кидки)
function masterTabs(d) {
  const r = d.room;
  const last = r.lastRollId || 0;
  if (S.seenRoll[r.id] == null || S.mtab === 'dice') S.seenRoll[r.id] = last;
  const fresh = last > S.seenRoll[r.id];
  return `<div class="tabs mtabs"><button class="${S.mtab !== 'dice' ? 'on' : ''}" data-act="mtab" data-tab="room">🏰 Кімната</button>
    <button class="tab-dice${S.mtab === 'dice' ? ' on' : ''}" data-act="mtab" data-tab="dice" aria-label="${esc(t('Кидки гравців'))}">🎲${fresh ? '<i class="dot"></i>' : ''}</button></div>`;
}
function playerCard(p) {
  const ch = p.character;
  if (!ch) {
    return `<div class="card list-item${p.helpRequested ? ' help-req' : ''}"><div class="ava">${p.helpRequested ? '🙋' : '⏳'}</div><div class="meta"><b>${esc(p.name)}</b>
    <small>${p.helpRequested ? 'просить допомогти створити персонажа' : 'ще не створив персонажа'}</small></div>
    ${p.helpRequested ? `<div class="help-actions"><button class="btn sm primary" data-act="helpCreate" data-uid="${p.userId}">Допомогти створити</button>` : ''}
    <button class="btn sm danger" data-act="kick" data-uid="${p.userId}" data-name="${esc(p.name)}">Видалити</button>${p.helpRequested ? '</div>' : ''}</div>`;
  }
  const s = ch.sheet;
  const dv = derived(ch);
  // у якій події зараз персонаж (майстру видно, хто де, коли група розділилась)
  const pev = S.room && S.room.room && S.room.room.events ? charEvent(S.room, ch.id) : null;
  return `<div class="card tap" data-act="openChar" data-id="${ch.id}" ${clsAttrs(s.classId, s.subclassId)}><div class="list-item">
    <div class="ava">${CLASS_ICON[s.classId] || '🧝'}</div>
    <div class="meta"><b>${esc(s.name)}</b><small>${esc(raceName(s))} · ${esc(className(s))} ${s.level} рів. · ${esc(p.name)}</small></div>
    <div class="center"><small>${ab('КЗ')}</small><div><b>${dv.ac}</b></div></div><span class="chev">›</span></div>
    <div class="row mt" style="margin-top:8px"><small class="grow">ХП ${s.hp.cur}/${s.hp.max}${s.hp.temp ? ` (+${s.hp.temp})` : ''}</small>
    ${(ch.effects || []).length ? `<span class="fx-mini" title="${esc(ch.effects.map((e) => t(fxView(e).name)).join(', '))}">${ch.effects.map((e) => esc(fxView(e).icon)).join('')}</span>` : ''}
    ${pev ? `<span class="badge red ev-badge" data-act="evTip" data-id="${pev.id}">${evType(pev.type)[1]} <span data-notr>${esc(pev.name)}</span></span>` : ''}
    ${s.targetLevel > s.level ? `<span class="badge gold">⬆️ очікує ${s.targetLevel} рів.</span>` : ''}${R.shortRestActive(s, nowSec()) ? ' <span class="badge green">☕</span>' : ''}${R.inspCount(s) ? ` <span class="badge gold">⭐ ${R.inspCount(s)}</span>` : ''}</div>
    <div class="hpbar"><i class="${hpClass(s)}" style="width:${Math.max(0, Math.min(100, (s.hp.cur / s.hp.max) * 100))}%"></i></div></div>`;
}
function playerNoCharHtml(d) {
  return `<div class="top"><h2>${esc(d.room.name)}</h2><button class="link" data-act="roomMenu">⋯</button></div>
  <div class="card center"><div style="font-size:52px">🎲</div><h3>Створи персонажа</h3>
    <p class="hint">Майстер: ${esc(d.room.masterName)}. Пройди кроки за правилами D&D 5e: раса, клас, характеристики, навички.</p>
    <button class="btn primary block mt" data-act="startCreate">Створити персонажа</button>
    ${d.helpRequested
    ? `<p class="hint mt">🙋 Ти попросив майстра допомогти. Він може створити персонажа за тебе — персонаж буде твоїм. Або створи сам.</p>
    <button class="btn block mt" data-act="askMaster" data-cancel="1">Скасувати прохання</button>`
    : '<button class="btn block mt" data-act="askMaster">🙋 Попросити майстра</button>'}</div>
  ${d.fallen.length ? `<h3 class="sec">☠ Загиблі персонажі</h3>${d.fallen.map((f) => `<div class="card list-item muted"><div class="ava">💀</div><div class="meta"><b>${esc(f.name)}</b>
  <small>${esc(R.CLASSES[f.classId] ? R.CLASSES[f.classId].name : '')} ${f.level} рів.</small></div></div>`).join('')}` : ''}`;
}

// ---------- Лист персонажа ----------
function charHtml(ch, M) {
  const RO = isRO();
  const s = ch.sheet;
  const dv = derived(ch);
  const next = s.level < 20 ? R.XP_TABLE[s.level] : null;
  const prev = R.XP_TABLE[s.level - 1] || 0;
  const pct = next ? Math.max(0, Math.min(100, ((s.xp - prev) / (next - prev)) * 100)) : 100;
  let h = M
    ? `<div class="top"><small class="hint">Гравець: ${esc(charOwnerName(ch))}</small></div>`
    : RO ? `<div class="top"><small class="hint">📚 Архів · 🏰 ${esc(S.archive.info.roomName)}</small>${archiveBadge(S.archive.info)}</div>`
      : `<div class="top"><small class="hint">🏰 ${esc(S.room.room.name)}</small><button class="link" data-act="roomMenu">⋯</button></div>`;
  const insp = R.inspCount(s);
  h += `<div class="char-head"><div class="emb" aria-hidden="true"></div><div class="nm">${CLASS_ICON[s.classId] || ''} ${esc(s.name)}${insp ? ` <span class="badge gold" title="Натхнення">⭐ ${insp}</span>` : ''}</div>
    <div class="sub">${esc(raceName(s))} · ${esc(className(s))}${s.subclass ? ` (${esc(s.subclass)})` : ''} · ${s.level} рівень</div>
    <div class="xp"><div class="bar"><i style="width:${pct}%"></i></div><small>Досвід: ${s.xp}${next ? ` / ${next}` : ''}</small></div></div>
  <div class="stats">
    <div class="stat"><small>${ab('КЗ')}</small><b>${dv.ac}</b></div>
    <div class="stat ${RO ? '' : 'tapable'}" ${RO ? '' : 'data-act="hpModal"'}><small>Хіти</small><b>${s.hp.cur}/${s.hp.max}</b>${s.hp.temp ? `<span class="tmp">+${s.hp.temp} ${ab('тимч.')}</span>` : ''}</div>
    <div class="stat"><small>${ab('Ініціат.')}</small><b>${fm(dv.init)}</b></div>
    <div class="stat"><small>${ab('Швидк.')}</small><b>${s.speed}</b></div>
    <div class="stat"><small>${ab('Майст.')}</small><b>${fm(dv.prof)}</b></div></div>
  <div class="hpbar"><i class="${hpClass(s)}" style="width:${Math.max(0, Math.min(100, (s.hp.cur / s.hp.max) * 100))}%"></i></div>
  ${effectsBlock(ch, M, RO)}`;
  if (RO) h += '<div class="card"><small class="hint">📚 Персонаж зберігається на пам’ять — лише перегляд, використати повторно не можна.</small></div>';
  if (!RO && s.targetLevel > s.level) {
    h += M ? `<div class="card"><span class="badge gold">⬆️ Гравцю доступне підвищення до ${s.targetLevel} рівня</span></div>`
      : `<button class="banner" data-act="openLevelUp">⬆️ Доступне підвищення до ${s.level + 1} рівня!<small>Натисни, щоб пройти підвищення за правилами 5e</small></button>`;
  }
  if (!RO && R.shortRestActive(s, nowSec())) {
    const hd = (R.CLASSES[s.classId] || { hd: 8 }).hd;
    const left = s.level - (s.hitDiceUsed || 0);
    const con = R.mod(s.abilities.con);
    h += M ? `<div class="card"><span class="badge green">☕ Короткий відпочинок триває</span> <small class="hint">кості хітів: ${left}/${s.level}</small></div>`
      : `<div class="card" style="border:1.5px solid #2fbf4a"><h3>☕ Короткий відпочинок</h3>
      <p class="hint">Витрачай кості хітів, щоб відновити ХП. Доступно: ${left}/${s.level} × к${hd}${con ? ` ${fm(con)}` : ''}</p>
      <div class="btns"><button class="btn primary ${left > 0 && s.hp.cur < s.hp.max ? '' : 'disabled'}" data-act="spendHD">🎲 Кинути к${hd}${con ? fm(con) : ''}</button>
      <button class="btn" data-act="endRest">Завершити відпочинок</button></div></div>`;
  }
  if (M) {
    h += `<div class="toolbar">
      <button class="btn" data-act="editSheet"><span class="e">✏️</span>Характеристики</button>
      <button class="btn" data-act="xpModal"><span class="e">⭐</span>Досвід</button>
      <button class="btn" data-act="grantLevel"><span class="e">⬆️</span>+1 рівень</button>
      <button class="btn" data-act="openCatalog"><span class="e">🎁</span>Видати предмет</button>
      <button class="btn" data-act="moneyModal" data-mode="set"><span class="e">💰</span>Гроші</button>
      <button class="btn" data-act="charMore"><span class="e">⋯</span>Ще</button></div>`;
  }
  // «Лист» тут — аркуш персонажа (не предмет «лист»), тому окремий ключ перекладу
  const tabs = [['sheet', LANG === 'uk' ? 'Лист' : t('Лист персонажа (вкладка)')], ['spells', 'Вміння'], ['info', 'Інфо'], ['inv', 'Інвентар']];
  // кидки кубиків — лише гравцеві на власному листі
  const canRoll = !M && !isRO();
  if (canRoll) tabs.push(['dice', '🎲']);
  if (S.tab === 'dice' && !canRoll) S.tab = 'sheet';
  h += `<div class="tabs">${tabs.map(([k, l]) => `<button class="${S.tab === k ? 'on' : ''}${k === 'dice' ? ' tab-dice' : ''}" data-act="tab" data-tab="${k}"${k === 'sheet' ? ' data-notr' : ''}${k === 'dice' ? ` aria-label="${esc(t('Кидки'))}"` : ''}>${l}</button>`).join('')}</div>`;
  if (S.tab === 'dice') h += diceTab(ch, dv);
  else if (S.tab === 'spells') h += spellsTab(ch, dv, M);
  else if (S.tab === 'info') h += infoTab(ch);
  else if (S.tab === 'inv') h += invTab(ch, M);
  else h += sheetTab(ch, dv);
  return h;
}

// ================= Кидки кубиків =================
const DICE = [4, 6, 8, 10, 12, 20, 100];
function diceState(ch) {
  if (!S.dice || S.dice.charId !== ch.id) S.dice = { charId: ch.id, purpose: 'free', dice: { 20: 1 }, mod: 0, mode: '', last: null };
  return S.dice;
}
const charWeapons = (ch) => (ch.items || []).map((it) => ({ it, d: withBase(it.data) }))
  .filter(({ d }) => d.type === 'weapon' || (['staff', 'rod'].includes(d.type) && d.damage))
  .sort((a, b) => Number(b.it.equipped) - Number(a.it.equipped));
// Кубики й модифікатор, що відповідають меті кидка (null — довільний кидок)
function diceAuto(ch, purpose) {
  const s = ch.sheet;
  const [kind, key] = String(purpose).split(':');
  const d20 = { 20: 1 };
  if (kind === 'init') return { dice: d20, mod: derived(ch).init };
  if (kind === 'ability' && s.abilities[key] != null) return { dice: d20, mod: R.mod(s.abilities[key]) };
  if (kind === 'save' && s.abilities[key] != null) return { dice: d20, mod: R.saveValue(s, key) };
  if (kind === 'skill' && R.SKILLS[key]) return { dice: d20, mod: R.skillValue(s, key) };
  if (kind === 'spellattack') return { dice: d20, mod: R.sheetProf(s) + R.mod(s.abilities[R.spellAbility(s)] || 10) };
  if (kind === 'damage' && !key) return null;
  if (kind === 'attack' || kind === 'damage') {
    const w = charWeapons(ch).find(({ it }) => String(it.id) === key);
    if (!w) return null;
    const a = R.weaponAttack(s, w.d);
    if (kind === 'attack') return { dice: d20, mod: a.hit };
    const m = /(\d*)\s*к\s*(\d+)/.exec(String(w.d.damage || ''));
    if (!m || !DICE.includes(Number(m[2]))) return null;
    return { dice: { [m[2]]: Number(m[1] || 1) }, mod: a.dmgMod };
  }
  return null;
}
const isCaster = (s) => R.sheetSlots(s).some((n) => n > 0) || ((s.spell && s.spell.spells) || []).length > 0;
const diceExpr = (st) => DICE.filter((sd) => st.dice[sd]).map((sd) => `${st.dice[sd]}к${sd}`).join('+') + (st.mod ? fm(st.mod) : '');
// Розклад кидка: «к20: 17 ̶4̶ · 2к6: 3, 5 · +3»
function rollBreakdown(r) {
  const parts = r.groups.map((g) => {
    let vals;
    if (g.s === 20 && r.mode) {
      vals = [];
      for (let i = 0; i < g.r.length; i += 2) {
        const keep = g.k[i / 2];
        const other = g.r[i] === keep ? g.r[i + 1] : g.r[i];
        vals.push(`<b>${keep}</b> <s>${other}</s>`);
      }
    } else vals = g.r.map((v) => `<b>${v}</b>`);
    return `<span class="nw">${g.n > 1 ? g.n : ''}к${g.s}: ${vals.join(', ')}</span>`;
  });
  if (r.mod) parts.push(`<span class="nw">${fm(r.mod)}</span>`);
  return parts.join(' · ');
}
const fmtTime = (ts) => new Date(ts * 1000).toLocaleTimeString(LOCALES[LANG], { hour: '2-digit', minute: '2-digit' });

function diceTab(ch, dv) {
  const s = ch.sheet;
  const st = diceState(ch);
  // ефекти змінились (майстер наклав/зняв) — перевага/перешкода перераховується
  const sig = (ch.effects || []).map((e) => `${e.key}:${e.n}`).join();
  if (st.fxSig !== sig) { st.fxSig = sig; st.mode = R.effectRoll(ch.effects, st.purpose).mode; }
  const auto = diceAuto(ch, st.purpose);
  const opt = (v, l) => `<option value="${esc(v)}" ${st.purpose === v ? 'selected' : ''}>${esc(l)}</option>`;
  const og = (label, items) => (items.length ? `<optgroup label="${esc(t(label))}">${items.map(([v, l]) => opt(v, l)).join('')}</optgroup>` : '');
  const weapons = charWeapons(ch);
  const sel = `<select class="dice-purpose" data-onchange="dicePurpose">
    ${opt('free', 'Довільний кидок')}${opt('init', `Ініціатива (${fm(dv.init)})`)}
    ${og('Перевірки характеристик', R.ABILITIES.map((a) => [`ability:${a}`, `${R.ABILITY_NAMES[a]} (${fm(R.mod(s.abilities[a]))})`]))}
    ${og('Рятівні кидки', R.ABILITIES.map((a) => [`save:${a}`, `${R.ABILITY_NAMES[a]} (${fm(R.saveValue(s, a))})`]))}
    ${og('Навички', R.SKILL_IDS.map((k) => [`skill:${k}`, `${R.SKILLS[k][0]} (${fm(R.skillValue(s, k))})`]))}
    ${og('Атаки', [...weapons.map(({ it, d }) => [`attack:${it.id}`, `${d.name} (${fm(R.weaponAttack(s, d).hit)})`]),
    ...(isCaster(s) ? [['spellattack', `Атака закляттям (${fm(diceAuto(ch, 'spellattack').mod)})`]] : [])])}
    ${og('Шкода', [...weapons.filter(({ d }) => d.damage).map(({ it, d }) => [`damage:${it.id}`, `${d.name} (${R.weaponAttack(s, d).dmg})`]),
    ['damage:', 'Шкода (закляття, інше)']])}
  </select>`;
  const any = DICE.some((sd) => st.dice[sd]);
  let h = `<div class="lines dice-box"><h3>🎲 Кидок</h3>
    <label class="fld"><span>На що</span>${sel}</label>
    ${fxHints(ch, st.purpose)}
    <div class="fld"><span>Кубики</span></div>
    <div class="dice-grid">${DICE.map((sd) => {
    const n = st.dice[sd] || 0;
    return `<div class="die ${n ? 'on' : ''}"><button class="die-b" data-act="dieAdd" data-s="${sd}"><span class="die-n">к${sd}</span>${n ? `<span class="die-c">×${n}</span>` : ''}</button>${n ? `<button class="die-m" data-act="dieSub" data-s="${sd}" aria-label="Менше">−</button>` : ''}</div>`;
  }).join('')}</div>
    <div class="row dice-mod"><span class="grow">Модифікатор</span>
      ${auto && auto.mod !== st.mod ? `<button class="link" data-act="diceModAuto">авто ${fm(auto.mod)}</button>` : ''}
      <div class="stepper"><button data-act="diceMod" data-d="-1" aria-label="Менше">−</button><b class="dice-modv">${fm(st.mod)}</b><button data-act="diceMod" data-d="1" aria-label="Більше">+</button></div></div>
    <div class="chips dice-modes">${[['adv', 'Перевага'], ['', 'Звичайний'], ['dis', 'Перешкода']].map(([v, l]) => `<button class="chip ${st.mode === v ? 'on' : ''} ${st.dice[20] ? '' : 'disabled'}" data-act="diceMode" data-v="${v}">${l}</button>`).join('')}</div>
    <button class="btn primary block mt ${any ? '' : 'disabled'}" data-act="rollDice">🎲 Кинути <span class="nw">${diceExpr(st)}</span></button>
    <div class="row mt"><small class="hint grow">Кидок робить сервер, майстер бачить його в журналі.</small><button class="link" data-act="diceReset">Скинути</button></div></div>`;
  const r = st.last;
  if (r) {
    h += `<div class="card dice-res${r.crit === 20 ? ' nat20' : r.crit === 1 ? ' nat1' : ''}" data-id="${r.id}">
      <small class="hint">${esc(r.label)}${r.mode ? ` · ${r.mode === 'adv' ? 'перевага' : 'перешкода'}` : ''}</small>
      <div class="dice-total">${r.total}</div>
      <div class="dice-bd">${rollBreakdown(r)}</div>
      ${r.crit === 20 ? '<span class="badge gold">природна 20!</span>' : r.crit === 1 ? '<span class="badge red">природна 1</span>' : ''}</div>`;
  }
  const hist = ch.rolls || [];
  h += `<div class="lines"><h3>Історія кидків</h3>${hist.length ? hist.map((x) => `<div class="ln dice-h"><span class="hint nw">${fmtTime(x.ts)}</span>
    <span class="grow"><span>${esc(x.label)}</span> ${markChip(x)}<br><small class="hint">${rollBreakdown(x)}</small></span><b class="v${x.crit === 20 ? ' c20' : x.crit === 1 ? ' c1' : ''}">${x.total}</b></div>`).join('')
    : '<div class="ln hint">Кидків ще не було</div>'}</div>`;
  return h;
}

function sheetTab(ch, dv) {
  const s = ch.sheet;
  let h = `<div class="abil mt">${R.ABILITIES.map((a) => `<div class="box"><small>${ab(R.ABILITY_SHORT[a])}</small>
    <div class="m">${fm(R.mod(s.abilities[a]))}</div><span class="s">${s.abilities[a]}</span></div>`).join('')}</div>`;
  h += `<div class="lines"><h3>Рятівні кидки</h3>${R.ABILITIES.map((a) => `<div class="ln"><span class="dot ${s.saves.includes(a) ? 'p' : ''}"></span>
    <span>${R.ABILITY_NAMES[a]}</span><span class="v">${fm(R.saveValue(s, a))}</span></div>`).join('')}</div>`;
  h += `<div class="lines"><h3>Навички</h3>${R.SKILL_IDS.map((k) => {
    const p = s.skills[k] || 0;
    return `<div class="ln"><span class="dot ${p === 2 ? 'e' : p === 1 ? 'p' : ''}"></span><span><span class="skilln" data-act="skillInfo" data-k="${k}">${R.SKILLS[k][0]}</span> <span class="ab">${ab(R.ABILITY_SHORT[R.SKILLS[k][1]])}</span></span>
    <span class="v">${fm(R.skillValue(s, k))}</span></div>`;
  }).join('')}<div class="ln"><span class="hint">● володіння · ◆ експертиза</span></div></div>`;
  const cls = R.CLASSES[s.classId];
  h += `<div class="lines"><h3>Бій</h3>
    <div class="ln"><span>Пасивна уважність</span><span class="v">${dv.pp}</span></div>
    <div class="ln"><span>Кості хітів</span><span class="v">${s.level - s.hitDiceUsed}/${s.level} × к${cls ? cls.hd : '?'}</span></div>
    <div class="ln"><span>Рятівні від смерті</span><span class="v">✅ ${s.deathSaves.s}/3 · ❌ ${s.deathSaves.f}/3</span></div>
    <div class="ln"><span class="grow">Натхнення</span><span class="v">⭐ ${R.inspCount(s)}</span>${isMaster() ? '<div class="stepper" style="margin-left:8px"><button data-act="insp" data-d="-1">−</button><button data-act="insp" data-d="1">+</button></div>' : ''}</div>
    ${isMaster() || isRO() ? '' : '<div class="ln"><span class="hint">Натхнення дає й забирає майстер.</span></div>'}</div>`;
  const weapons = (ch.items || []).map((it) => ({ it, d: withBase(it.data) }))
    .filter(({ d }) => d.type === 'weapon' || (['staff', 'rod'].includes(d.type) && d.damage))
    .sort((a, b) => Number(b.it.equipped) - Number(a.it.equipped));
  h += `<div class="lines"><h3>Атаки</h3>${weapons.length ? weapons.map(({ it, d }) => {
    const w = R.weaponAttack(s, d);
    return `<div class="ln rc-${esc(d.rarity)}" data-act="itemModal" data-id="${it.id}" style="cursor:pointer"><span class="grow"><span class="rname">${esc(d.name)}</span>${it.equipped ? ' <span class="badge">в руках</span>' : ''}${w.noProf ? ' <span class="badge warn">без володіння</span>' : ''}
    ${d.damage2 ? `<br><small>${esc(d.damage2)}</small>` : ''}</span><span class="v">${fm(w.hit)} · ${d.damage ? abbrify(w.dmg) : 'шкода не вказана'}</span></div>`;
  }).join('') : '<div class="ln hint">Немає зброї в інвентарі</div>'}</div>`;
  const badArmor = (ch.items || []).filter((it) => it.equipped && R.armorProficient(s, it.data) === false);
  const heavy = (ch.items || []).find((it) => it.equipped && it.data.type === 'armor' && it.data.strReq && s.abilities.str < it.data.strReq);
  if (badArmor.length || heavy) {
    h += `<div class="card warnbox">${badArmor.map((it) => `<p>⚠️ Немає володіння: <b>${esc(it.data.name)}</b>. Перешкода на перевірки, рятівні кидки й атаки з СИЛ або СПР, не можна творити закляття.</p>`).join('')}
      ${heavy ? `<p>⚠️ <b>${esc(heavy.data.name)}</b>: потрібна Сила ${heavy.data.strReq} — швидкість −10 фт.</p>` : ''}</div>`;
  }
  h += `<div class="lines"><h3>Володіння та мови</h3>${profLinesHtml(R.profOf(s))}</div>`;
  h += textSection(s, 'proficiencies', 'Нотатки до володінь');
  return h;
}

function textSection(s, key, title) {
  const t = s.text[key] || '';
  return `<div class="lines"><div class="row"><h3 class="grow">${title || R.TEXT_FIELDS[key]}</h3>${isRO() ? '' : `<button class="link" data-act="editText" data-fields="${key}">Змінити</button>`}</div>
  <div class="textblock ${t ? '' : 'empty'}">${t ? esc(t) : 'Порожньо'}</div></div>`;
}

function spellsTab(ch, dv, M) {
  const s = ch.sheet;
  let h = '';
  // Ресурси класу
  const res = R.sheetResources(s);
  if (res.length) {
    h += `<div class="lines"><h3>Ресурси</h3>${res.map((r) => {
      const icon = r.recharge === 'short' ? '☕' : '🌙';
      if (r.pool || r.max > 12) {
        return `<div class="ln"><span class="grow">${esc(r.name)} <span class="hint">${icon}</span></span>${infoBtn('resInfo', `data-id="${r.id}"`)}<span class="v">${r.max - r.used}/${r.max}</span>
        <button class="btn sm" data-act="poolModal" data-id="${r.id}">${M ? 'Змінити' : 'Витратити'}</button></div>`;
      }
      return `<div class="ln"><span style="min-width:120px" class="row">${esc(r.name)} <span class="hint">${icon}</span>${infoBtn('resInfo', `data-id="${r.id}"`)}</span>
        <div class="slots">${Array.from({ length: r.max }, (_, j) => `<button class="slot ${j < r.used ? 'used' : 'free'}" data-act="res" data-id="${r.id}" data-j="${j}"></button>`).join('')}</div>
        <span class="v hint">${r.max - r.used}/${r.max}</span></div>`;
    }).join('')}<div class="ln"><span class="hint">☕ — відновлюється на короткому, 🌙 — на довгому відпочинку (оголошує майстер).</span></div></div>`;
  }
  // Заклинання
  const caster = R.isCaster(s);
  const slots = dv.slots;
  const used = s.spell.slotsUsed || [];
  if (caster) {
    const ab = R.spellAbility(s);
    const m = R.mod(s.abilities[ab]);
    h += `<div class="lines"><h3>Заклинання</h3>
      <div class="ln"><span>Характеристика</span><span class="v">${R.ABILITY_NAMES[ab]}</span></div>
      <div class="ln"><span>СК рятівного кидка</span><span class="v">${8 + dv.prof + m}</span></div>
      <div class="ln"><span>Бонус атаки закляттям</span><span class="v">${fm(dv.prof + m)}</span></div></div>`;
  }
  if (slots.some((x) => x > 0)) {
    h += `<div class="lines"><h3>Комірки заклять</h3>${slots.map((max, i) => (max ? `<div class="ln"><span style="min-width:62px">${i + 1} коло</span>
      <div class="slots">${Array.from({ length: max }, (_, j) => `<button class="slot ${j < (used[i] || 0) ? 'used' : 'free'}" data-act="slot" data-l="${i}" data-j="${j}"></button>`).join('')}</div>
      <span class="v hint">${max - (used[i] || 0)}/${max}</span></div>` : '')).join('')}
      <div class="ln"><span class="hint">Натисни на комірку, щоб витратити. Відновлюються на відпочинку.</span></div></div>`;
  }
  h += spellsListHtml(s, M);
  // Вміння та риси
  const feats = Array.isArray(s.features) ? s.features.map((x, i) => ({ ...x, _i: i })) : null;
  h += '<div class="lines"><div class="row"><h3 class="grow">Вміння та риси</h3>';
  if (M && feats) h += '<button class="link" data-act="featureForm">＋ Додати</button>';
  h += '</div>';
  if (!feats) {
    h += `<div class="textblock empty">Вміння за класом з’являться після наступного підвищення рівня.</div>
      ${M ? '<button class="btn sm" data-act="fillFeatures" style="margin-bottom:12px">⚙️ Заповнити за класом і рівнем</button>' : ''}`;
  } else if (!feats.length) h += '<div class="textblock empty">Порожньо</div>';
  else {
    const order = ['race', 'class', 'subclass', 'choice', 'feat', 'custom'];
    for (const src of order) {
      const part = feats.filter((x) => (x.src || 'custom') === src).sort((a, b) => a.lvl - b.lvl);
      if (part.length) h += `<div class="spell-lvl">${SRC_LABEL[src]}</div>${featureListHtml(part, { showLvl: src !== 'race', del: M, compact: true })}`;
    }
  }
  h += '</div>';
  h += textSection(s, 'features', 'Нотатки до вмінь');
  return h;
}

// Закляття персонажа у вкладці «Вміння»
function spellsListHtml(s, M) {
  let h = '';
  const plan = R.spellPlan(s);
  const list = s.spell.spells || [];
  const usage = R.spellPoolUsage(s, list);
  const free = usage.reduce((t, p) => t + Math.max(0, p.count - p.used), 0);
  if (!isRO()) {
    if (M) h += '<div class="btns"><button class="btn" data-act="spellPick">📖 Закляття персонажа</button><button class="btn" data-act="spellForm">＋ Власне закляття</button></div>';
    else if (plan.pools.length || list.length) {
      const bits = [];
      if (free) bits.push(`вільних місць: ${free}`);
      if (plan.swaps && plan.canSwap) bits.push('можна замінити одне відоме');
      if (plan.prep && plan.prepOpen) bits.push('можна змінити підготовку');
      h += bits.length ? `<div class="card notice"><b>📖 Закляття</b><p class="hint" style="margin:4px 0 8px">${esc(bits.join(' · '))}</p><button class="btn primary block" data-act="spellPick">Обрати закляття</button></div>`
        : '<div class="btns"><button class="btn" data-act="spellPick">📖 Мої закляття</button></div>';
    }
  }
  const prepCaster = plan.prep && plan.prep.from === 'list';
  const rows = [
    ...plan.always.map((x) => ({ sid: x.sid, name: R.SPELLS[x.sid].name, level: R.SPELLS[x.sid].level, badge: x.src, prepared: true, fixed: true })),
    ...list.map((e) => ({ ...e, badge: e.by === 'm' ? 'від майстра' : POOL_BADGE[e.pool] || (e.sid ? '' : 'власне') })),
  ];
  for (let lvl = 0; lvl <= 9; lvl++) {
    const sp = rows.filter((x) => x.level === lvl).sort((a, b) => t(a.name).localeCompare(t(b.name), LOCALES[LANG]));
    if (!sp.length) continue;
    h += `<div class="lines"><h3>${lvl === 0 ? 'Замовляння' : `${lvl} коло`}</h3>${sp.map((x) => {
      const d = x.sid ? R.SPELLS[x.sid] : x;
      const ready = lvl === 0 || x.fixed || !plan.prep || x.prepared || prepCaster;
      return `<div class="ln" data-act="spellModal" data-id="${esc(x.id || '')}" data-sid="${esc(x.sid || '')}" style="cursor:pointer">
        <span class="dot ${ready ? 'p' : ''}" title="${ready ? 'Підготовлено' : 'Не підготовлено'}"></span>
        <span class="grow"><b>${esc(x.name)}</b>${d.conc ? ` <span class="badge">${ab('К')}</span>` : ''}${d.ritual ? ` <span class="badge">${ab('Р')}</span>` : ''}${x.badge ? ` <span class="badge">${esc(x.badge)}</span>` : ''}
        <br><small>${esc([d.school, d.time, d.range].filter(Boolean).join(' · '))}</small></span></div>`;
    }).join('')}</div>`;
  }
  if (plan.prep && plan.prep.from === 'book') h += '<p class="hint center">● підготовлено · ○ лише в книзі заклять</p>';
  return h;
}
const POOL_BADGE = { raceCantrip: 'раса', bonusCantrip: 'підклас', tome: 'книга тіней', miCantrips: 'ініціат магії', miSpell: 'ініціат магії', loreSecrets: 'таємниці',
  arcanum6: 'арканум', arcanum7: 'арканум', arcanum8: 'арканум', arcanum9: 'арканум' };

// ---------- Вибір заклять (екран персонажа й крок майстра створення) ----------
function pickCtx() {
  if (cur().view === 'create') return { st: S.wiz.sp, sheet: wizPreview(), mode: 'create', orig: [], bind: 'wiz.sp.q' };
  const ch = currentChar();
  return { st: S.pick, sheet: ch ? ch.sheet : null, mode: S.pick.mode, orig: S.pick.orig, bind: 'pick.q' };
}
// Чи можна прибрати запис (так само перевіряє сервер)
function canDropSpell(ctx, e, plan) {
  if (ctx.mode === 'master' || ctx.mode === 'create') return true;
  const old = ctx.orig.find((x) => x.id === e.id);
  if (!old) return true;
  if (!old.sid || old.by === 'm') return false;
  if (old.pool === 'prep') return plan.prepOpen;
  if (old.pool === 'known') {
    const dropped = ctx.orig.filter((x) => x.pool === 'known' && x.sid && x.by !== 'm' && !ctx.st.list.some((y) => y.id === x.id)).length;
    return dropped < plan.swaps;
  }
  return false;
}
const spellMeta = (sp) => [sp.level ? `${sp.level} коло` : 'замовляння', sp.school, sp.conc ? 'концентрація' : '', sp.ritual ? 'ритуал' : ''].filter(Boolean).join(' · ');
function pickPools(ctx, plan) {
  const list = ctx.st.list;
  const tabs = plan.pools.map((p) => ({ ...p, used: list.filter((e) => e.sid && e.by !== 'm' && e.pool === p.id).length }));
  if (plan.prep && plan.prep.from === 'book') tabs.push({ id: '_prep', name: 'Підготовка', count: plan.prep.max, used: list.filter((e) => e.prepared && e.level > 0).length });
  if (ctx.mode === 'master') tabs.push({ id: 'extra', name: 'Будь-яке', count: 0, lists: Object.keys(R.SPELL_LIST_NAMES), min: 0, max: 9, any: true });
  return tabs;
}
function spellPickerHtml() {
  const ctx = pickCtx();
  const { st, sheet } = ctx;
  if (!sheet) return loadingHtml();
  const plan = R.spellPlan(sheet);
  const tabs = pickPools(ctx, plan);
  if (!tabs.length) return '<div class="card"><p class="hint">Персонаж поки не творить закляття.</p></div>';
  if (!tabs.some((t) => t.id === st.pool)) st.pool = tabs[0].id;
  let h = `<div class="chips wrap">${tabs.map((t) => `<button class="chip ${st.pool === t.id ? 'on' : ''}" data-act="spPool" data-p="${t.id}">${esc(t.name)}${t.id === 'extra' ? '' : ` ${t.used}/${t.count}`}</button>`).join('')}</div>`;
  const notes = [];
  if (ctx.mode === 'create') notes.push('Можна обрати й пізніше — вільні місця лишаться у вкладці «Вміння».');
  if (ctx.mode === 'player') {
    if (plan.canSwap) notes.push(plan.swaps ? 'Можеш замінити одне відоме закляття: зніми позначку з одного й обери інше.' : 'Відомі закляття замінюються лише при підвищенні рівня.');
    if (plan.prep) notes.push(plan.prepOpen ? 'Підготовку можна змінити зараз; після збереження — знову після довгого відпочинку чи підвищення рівня.' : 'Підготовку можна змінити після довгого відпочинку (оголошує майстер) або підвищення рівня.');
  }
  if (ctx.mode === 'master') notes.push('Закляття від майстра не займають місць гравця, і гравець не може їх прибрати.');
  if (plan.always.length) notes.push(`Завжди підготовлені (не займають місць): ${plan.always.map((x) => R.SPELLS[x.sid].name).join(', ')}.`);
  const pool = tabs.find((t) => t.id === st.pool);
  if (pool.offList) notes.push(`${pool.offListName}: до ${pool.offList} заклять з будь-якого класу.`);
  if (pool.schools) notes.push(`Школи «${pool.schools.join('» і «')}»; з інших шкіл — до ${pool.offSchool}.`);
  if (notes.length) h += `<div class="card">${notes.map((n) => `<p class="hint" style="margin:4px 0">${esc(n)}</p>`).join('')}</div>`;
  if (st.pool === '_prep') return h + prepListHtml(ctx, plan);
  const lo = pool.max === 0 ? 0 : Math.max(1, pool.min);
  const lvls = Array.from({ length: pool.max - lo + 1 }, (_, i) => lo + i);
  if (lvls.length > 1) {
    h += `<div class="chips"><button class="chip ${st.lvl === 'all' ? 'on' : ''}" data-act="spLvl" data-l="all">Усі</button>${lvls.map((l) => `<button class="chip ${String(st.lvl) === String(l) ? 'on' : ''}" data-act="spLvl" data-l="${l}">${l ? `${l} коло` : 'Замовляння'}</button>`).join('')}</div>`;
  }
  h += `<input class="mt" data-bind="${ctx.bind}" data-live="spells" value="${esc(st.q)}" placeholder="🔎 Пошук закляття">`;
  return `${h}<div id="spList" class="lines mt">${spellRowsHtml(ctx, plan, pool)}</div>`;
}
function prepListHtml(ctx, plan) {
  const book = ctx.st.list.filter((e) => e.level > 0);
  if (!book.length) return '<div class="lines"><div class="ln hint">Книга заклять порожня</div></div>';
  const n = book.filter((e) => e.prepared).length;
  return `<p class="hint">Підготовлено ${n} з ${plan.prep.max}</p><div class="lines">${book.map((e) => {
    const sp = e.sid ? R.SPELLS[e.sid] : null;
    return `<div class="pick" data-act="spPrep" data-id="${esc(e.id)}"><input type="checkbox" ${e.prepared ? 'checked' : ''} tabindex="-1" style="pointer-events:none">
      <span class="grow"><b>${esc(e.name)}</b><br><small>${esc(sp ? spellMeta(sp) : `${e.level} коло`)}</small></span>${sp ? infoBtn('spellInfo', `data-sid="${sp.id}"`) : ''}</div>`;
  }).join('')}</div>`;
}
function spellRowsHtml(ctx = pickCtx(), plan = R.spellPlan(ctx.sheet), pool = pickPools(ctx, plan).find((t) => t.id === ctx.st.pool)) {
  if (!pool) return '';
  const { st } = ctx;
  const list = st.list;
  const q = String(st.q || '').trim().toLowerCase();
  const full = pool.id !== 'extra' && pool.used >= pool.count;
  const own = (sp) => sp.classes.some((c) => (pool.lists || []).includes(c)) || (pool.extra || []).includes(sp.id);
  const ids = R.SPELL_IDS.filter((id) => {
    const sp = R.SPELLS[id];
    if (pool.id !== 'extra' && R.spellFitsPool(pool, sp)) return false;
    if (st.lvl !== 'all' && String(sp.level) !== String(st.lvl)) return false;
    return !q || sp.name.toLowerCase().includes(q) || (D && t(sp.name).toLowerCase().includes(q));
  }).sort((a, b) => Number(own(R.SPELLS[b])) - Number(own(R.SPELLS[a])));
  if (!ids.length) return '<div class="ln hint">Нічого не знайдено</div>';
  return ids.map((id) => {
    const sp = R.SPELLS[id];
    const e = list.find((x) => x.sid === id && (x.pool === pool.id || (pool.id === 'extra' && x.by === 'm')));
    const elsewhere = !e && list.some((x) => x.sid === id);
    const always = plan.always.some((x) => x.sid === id);
    const locked = e && !canDropSpell(ctx, e, plan);
    const dis = !e && (full || elsewhere || always);
    const tag = locked ? '🔒' : elsewhere ? 'вже обрано' : always ? 'завжди підготовлене' : !own(sp) ? (pool.offListName || 'інший клас') : pool.schools && sp.level && !pool.schools.includes(sp.school) ? 'інша школа' : '';
    return `<div class="pick ${dis ? 'disabled' : ''}" data-act="spToggle" data-sid="${id}"><input type="checkbox" ${e ? 'checked' : ''} tabindex="-1" style="pointer-events:none">
      <span class="grow"><b>${esc(sp.name)}</b><br><small>${esc(spellMeta(sp))}</small></span>${tag ? `<span class="v hint">${esc(tag)}</span>` : ''}${infoBtn('spellInfo', `data-sid="${id}"`)}</div>`;
  }).join('');
}

function infoTab(ch) {
  const s = ch.sheet;
  const phys = ['age', 'height', 'weight', 'eyes', 'skin', 'hair'];
  let h = `<div class="lines"><div class="row"><h3 class="grow">Про персонажа</h3>${isRO() ? '' : '<button class="link" data-act="editText" data-fields="info">Змінити</button>'}</div>
    <div class="ln"><span>Передісторія</span><span class="v">${esc(bgName(s))}</span></div>
    <div class="ln"><span>Світогляд</span><span class="v">${esc(s.alignment || '—')}</span></div>
    ${phys.map((k) => `<div class="ln"><span>${R.TEXT_FIELDS[k]}</span><span class="v">${esc(s.text[k] || '—')}</span></div>`).join('')}</div>`;
  for (const k of ['personality', 'ideals', 'bonds', 'flaws', 'appearance', 'backstory', 'allies', 'treasure']) h += textSection(s, k);
  return h;
}

function invTab(ch, M) {
  const s = ch.sheet;
  const items = (ch.items || []).slice().sort((a, b) => Number(b.equipped) - Number(a.equipped) || t(a.data.name).localeCompare(t(b.data.name), LOCALES[LANG]));
  const weight = items.reduce((t, it) => t + num(it.data.weight) * it.qty, 0);
  const cap = s.abilities.str * 15;
  const attuned = items.filter((it) => it.attuned).length;
  let h = `<div class="card"><div class="row"><h3 class="grow">💰 Гроші</h3>${M ? '<button class="link" data-act="moneyModal" data-mode="set">Змінити</button>' : ''}</div>
    <div class="money mt">${R.COINS.map((k) => `<div class="coin ${k}"><small>${ab(R.COIN_NAMES[k])}</small><b>${s.money[k] || 0}</b></div>`).join('')}</div>
    ${M || isRO() ? '' : `<div class="btns"><button class="btn sm" data-act="moneyModal" data-mode="spend">Витратити</button>${S.room.mates.length ? '<button class="btn sm" data-act="moneyModal" data-mode="give">Передати</button>' : ''}</div>`}</div>
  <div class="row mt"><small class="grow">Вага: ${Math.round(weight * 10) / 10} / ${cap} ${ab('фнт')}</small><small>Налаштовано: ${attuned}/3</small></div>`;
  if (M) h += `<div class="btns"><button class="btn primary" data-act="openCatalog">🎁 З каталогу</button><button class="btn" data-act="customItem">＋ Свій предмет</button></div>`;
  h += items.length ? items.map(itemRow).join('') : empty('🎒', M ? 'Інвентар порожній. Видай предмети з каталогу.' : 'Інвентар порожній. Предмети видає майстер.');
  return h;
}
function itemSub(d, it) {
  const cat = R.itemCat(d);
  return [cat ? R.ITEM_CATS[cat] : R.ITEM_TYPES[d.type], d.damage && `${d.damage} ${d.dmgType || ''}`.trim(), d.type === 'armor' && d.ac && `КЗ ${d.ac + num(d.bonus)}`,
    d.type === 'shield' && `+${num(d.ac, 2) + num(d.bonus)} КЗ`, d.bonus && d.type !== 'armor' && d.type !== 'shield' && `+${d.bonus}`,
    it && it.equipped && 'екіпіровано', it && it.attuned && 'налаштовано'].filter(Boolean).join(' · ');
}
function itemRow(it) {
  const d = it.data;
  return `<div class="item rc-${esc(d.rarity)}" data-act="itemModal" data-id="${it.id}"><span class="ic">${ITEM_ICON[d.type] || '📦'}</span>
  <div class="meta"><div class="nm">${esc(d.name)}</div><small>${esc(itemSub(d, it))}</small></div><span class="q">×${it.qty}</span></div>`;
}

// Налаштування початкового рівня (створення кімнати й налаштування)
function startLevelHtml(pickPath, on, maxPath, max, rerender) {
  const lv = Array.from({ length: 19 }, (_, i) => i + 2);
  return `<label class="row mt" style="gap:10px;cursor:pointer"><input type="checkbox" data-bind="${pickPath}" data-rerender="${rerender}" ${on ? 'checked' : ''}>
    <span>Гравці можуть обрати рівень персонажа</span></label>
    ${on ? `<label class="fld"><span>Максимальний початковий рівень</span><select data-bind="${maxPath}" data-num data-rerender="${rerender}">
      ${lv.map((l) => `<option value="${l}" ${l === Number(max) ? 'selected' : ''}>${l} рівень</option>`).join('')}</select></label>
      <small class="hint">Гравець обере рівень від 1 до ${Number(max)} і пройде всі вибори розвитку за правилами D&D 5e.</small>`
    : '<small class="hint">Вимкнено — усі персонажі починають з 1 рівня.</small>'}`;
}

// ---------- Вибори класу (спільне для створення й підвищення) ----------
function getPath(path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), S); }
function rerenderFor(path) { if (path.startsWith('modal')) renderModal(); else render(); }
function subclassSummary(classId, id) {
  const sc = R.CLASS_DATA[classId].subclasses[id];
  return Object.entries(sc.features || {}).map(([l, list]) => `${l}: ${list.map((x) => x[0]).join(', ')}`).join(' · ')
    || (sc.choices || []).map((c) => c.name).join(', ');
}
function subclassPickerHtml(classId, selected, path) {
  const cd = R.CLASS_DATA[classId];
  return `<div class="card"><h3>${esc(cd.subclassLabel)}</h3><p class="hint">Обери один варіант — його вміння додадуться автоматично.</p>
  ${Object.entries(cd.subclasses).map(([id, sc]) => `<div class="pick" data-act="pickSubclass" data-path="${path}" data-k="${id}">
    <input type="radio" ${selected === id ? 'checked' : ''} tabindex="-1" style="pointer-events:none">
    <span class="grow"><b>${esc(sc.name)}</b><br><small>${esc(subclassSummary(classId, id))}</small></span></div>`).join('')}</div>`;
}
// specs — R.pendingChoices(...); optSheet — лист для перевірки доступності варіантів
function choicesHtml(specs, optSheet, level, path, picks) {
  return specs.map((spec) => {
    const opts = R.choiceOptions(spec, typeof optSheet === 'function' ? optSheet(spec) : optSheet, level);
    const sel = picks[spec.id] || [];
    return `<div class="card"><h3>${esc(spec.name)}</h3><p class="hint">Обери ${spec.need} (${sel.length}/${spec.need})</p>
    ${opts.map((op) => {
      const on = sel.includes(op.id);
      const dis = op.disabled || (!on && sel.length >= spec.need && spec.need > 1);
      return `<div class="pick ${dis && !on ? 'disabled' : ''}" data-act="pickChoice" data-path="${path}" data-spec="${spec.id}" data-k="${op.id}" data-max="${spec.need}">
      <input type="${spec.need === 1 ? 'radio' : 'checkbox'}" ${on ? 'checked' : ''} tabindex="-1" style="pointer-events:none">
      <span class="grow"><b>${esc(op.name)}</b>${op.desc ? `<br><small>${abbrify(op.desc)}</small>` : ''}</span>${op.reason ? `<span class="v hint">${esc(op.reason)}</span>` : ''}</div>`;
    }).join('')}</div>`;
  }).join('');
}
const infoBtn = (act, attrs) => `<button class="info-i" data-act="${act}" ${attrs} aria-label="Детальніше">i</button>`;
function featureListHtml(list, opts = {}) {
  if (!list.length) return '';
  if (opts.compact) {
    return list.map((x) => `<div class="ln tapline" data-act="featInfo" data-i="${x._i}"><span class="grow"><b>${esc(x.name)}</b>
      ${opts.showLvl ? ` <span class="badge">${x.lvl} рів.</span>` : ''}</span>${infoBtn('featInfo', `data-i="${x._i}"`)}
      ${opts.del ? `<button class="x" data-act="delFeature" data-i="${x._i}">✕</button>` : ''}</div>`).join('');
  }
  return list.map((x) => `<div class="ln" style="align-items:flex-start"><span class="grow"><b>${esc(x.name)}</b>
    ${opts.showLvl ? ` <span class="badge">${x.lvl} рів.</span>` : ''}${opts.showSrc ? ` <span class="badge">${SRC_LABEL[x.src] || ''}</span>` : ''}
    ${x.desc ? `<br><small>${abbrify(x.desc)}</small>` : ''}</span>${opts.del ? `<button class="x" data-act="delFeature" data-i="${x._i}">✕</button>` : ''}</div>`).join('');
}

// ---------- Створення персонажа ----------
// forPlayer — гравець, за якого (на його прохання) персонажа створює майстер
function newWizard(forPlayer) {
  return {
    forUserId: forPlayer ? forPlayer.userId : null, forName: forPlayer ? forPlayer.name : '',
    step: 1, name: '', raceId: '', classId: '', backgroundId: '', alignment: '', level: 1,
    method: 'standard', assign: {}, pb: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    rolls: (forPlayer ? forPlayer.lastRoll : S.room && S.room.lastRoll) || null, raceChoice: [], skills: [], raceSkills: [], bgSkills: [], expertise: [], text: {}, subclassId: '', choices: {},
    asi: {}, expertiseAt: {}, choicesUp: {}, profPicks: {}, sp: { list: [], pool: '', q: '', lvl: 'all' }, equip: { gold: false, opts: [], picks: {} },
  };
}
// Попередній лист у майстрі (без перевірки володінь і заклять)
let wizPv = { k: '', v: null };
function wizPreview() {
  const inp = wizInput({ spells: [] });
  const k = JSON.stringify(inp);
  if (wizPv.k !== k) wizPv = { k, v: R.buildCharacter(inp, { partial: true }).sheet || null };
  return wizPv.v;
}
function wizEquipResult() {
  const w = S.wiz;
  const pre = wizPreview();
  return R.resolveEquipment(w.classId, w.backgroundId, w.equip, w.profPicks, pre && pre.prof);
}
const roomMaxLevel = () => Math.max(1, Number(S.room && S.room.room && S.room.room.maxStartLevel) || 1);
const wizLevel = () => Math.min(roomMaxLevel(), Math.max(1, Number(S.wiz.level) || 1));
// Кроки майстра: «Розвиток» з'являється, якщо персонаж починає вище 1 рівня
function wizSteps() {
  const w = S.wiz;
  const pre = w.raceId && w.classId && w.backgroundId ? wizPreview() : null;
  return ['basics', 'abilities', 'skills', ...(wizLevel() > 1 ? ['levels'] : []),
    ...(pre && R.profChoiceSpecs(pre).length ? ['prof'] : []), ...(pre && R.spellPlan(pre).pools.length ? ['spells'] : []), 'equip', 'desc'];
}
const wizStepName = () => wizSteps()[S.wiz.step - 1] || 'basics';
function wizPool() { const w = S.wiz; return w.method === 'standard' ? R.STANDARD_ARRAY : (w.rolls || []); }
function wizBase() {
  const w = S.wiz;
  if (w.method === 'pointbuy') return { ...w.pb };
  const pool = wizPool();
  const base = {};
  const used = new Set();
  for (const a of R.ABILITIES) {
    const idx = w.assign[a];
    if (idx === undefined || idx === '' || idx === null || used.has(String(idx)) || pool[Number(idx)] === undefined) return null;
    used.add(String(idx));
    base[a] = pool[Number(idx)];
  }
  return base;
}
const pbSpent = () => R.ABILITIES.reduce((t, a) => t + R.POINT_BUY_COST[S.wiz.pb[a]], 0);
function wizInput(over = {}) {
  const w = S.wiz;
  return {
    name: w.name, raceId: w.raceId, classId: w.classId, backgroundId: w.backgroundId, alignment: w.alignment,
    base: wizBase() || {}, raceChoice: w.raceChoice, skills: w.skills, raceSkills: w.raceSkills, bgSkills: w.bgSkills, expertise: w.expertise, text: w.text,
    subclassId: w.subclassId, choices: w.choices,
    level: wizLevel(), asi: w.asi, expertiseAt: w.expertiseAt, choicesUp: w.choicesUp,
    profPicks: w.profPicks, spells: w.sp.list, equip: w.equip, ...over,
  };
}
function wizFixedSkills() {
  const w = S.wiz;
  const race = R.RACES[w.raceId] || {};
  const bg = R.BACKGROUNDS[w.backgroundId] || { skills: [] };
  return new Set([...(bg.choose ? w.bgSkills : bg.skills), ...(race.skills || [])]);
}
function wizStepError(name = wizStepName()) {
  const w = S.wiz;
  if (name === 'basics') {
    if (!w.name.trim()) return 'Вкажи ім’я';
    if (!w.raceId || !w.classId || !w.backgroundId) return 'Обери расу, клас і передісторію';
  }
  if (name === 'abilities') {
    if (!wizBase()) return w.method === 'roll' && !w.rolls ? 'Кинь кубики' : 'Розподіли всі значення';
    if (w.method === 'pointbuy' && pbSpent() > R.POINT_BUY_TOTAL) return 'Перевищено бюджет очок';
    const race = R.RACES[w.raceId];
    if (race.choose && w.raceChoice.length !== race.choose.count) return `Обери ${race.choose.count} характеристики для бонусу раси`;
  }
  if (name === 'skills') {
    const { errors } = R.buildCharacter(wizInput({ level: 1 }), { partial: true });
    if (errors.length) return errors[0];
  }
  if (name === 'levels') {
    const { errors } = R.buildCharacter(wizInput(), { partial: true });
    if (errors.length) return errors[0];
  }
  if (name === 'prof') {
    const e = R.buildProf(wizPreview(), w.profPicks).errors;
    if (e.length) return e[0];
  }
  if (name === 'spells') {
    const e = R.checkSpells(wizPreview(), [], w.sp.list, 'create').errors;
    if (e.length) return e[0];
  }
  if (name === 'equip' || name === 'desc') {
    const e = wizEquipResult().errors;
    if (e.length) return e[0];
  }
  if (name === 'desc') {
    const { errors } = R.buildCharacter(wizInput());
    if (errors.length) return errors[0];
  }
  return null;
}
// Помилка будь-якого кроку до поточного включно (на випадок змін на попередніх кроках)
function wizFirstError(upto = S.wiz.step) {
  const steps = wizSteps();
  for (let i = 0; i < upto && i < steps.length; i++) {
    const e = wizStepError(steps[i]);
    if (e) return { step: i + 1, err: e };
  }
  return null;
}
function createHtml() {
  const w = S.wiz;
  if (!w) return loadingHtml();
  const steps = wizSteps();
  if (w.step > steps.length) w.step = steps.length;
  const name = wizStepName();
  const err = wizStepError(name);
  const titles = { basics: 'Основне', abilities: 'Характеристики', skills: 'Навички', levels: `Розвиток до ${wizLevel()} рівня`, prof: 'Володіння й мови', spells: 'Закляття', equip: 'Спорядження', desc: 'Підсумок' };
  let h = `<div class="top"><h2>Новий персонаж</h2><small class="hint">Крок ${w.step}/${steps.length} · ${titles[name]}</small></div>
  <div class="steps">${steps.map((_, i) => `<i class="${i < w.step ? 'on' : ''}"></i>`).join('')}</div>
  ${w.forUserId ? `<div class="card help-for">🙋 Створюєш персонажа для гравця <b>${esc(w.forName)}</b>. Персонаж буде його, а не твоїм.</div>` : ''}`;
  if (name === 'basics') h += wizStep1();
  if (name === 'abilities') h += wizStep2();
  if (name === 'skills') h += wizStep3();
  if (name === 'levels') h += wizStepLevels();
  if (name === 'prof') h += wizStepProf();
  if (name === 'spells') h += spellPickerHtml();
  if (name === 'equip') h += wizStepEquip();
  if (name === 'desc') h += wizStep4();
  const last = w.step >= steps.length;
  h += `<p class="hint center mt" id="wizErr" ${err ? '' : 'hidden'}>⚠️ ${esc(err || '')}</p><div class="btns mt2">
    ${w.step > 1 ? '<button class="btn" data-act="wizStep" data-d="-1">← Назад</button>' : ''}
    ${!last ? `<button class="btn primary ${err ? 'dim' : ''}" id="wizNext" data-act="wizStep" data-d="1">Далі →</button>`
    : `<button class="btn primary ${err ? 'dim' : ''}" id="wizNext" data-act="createChar">✅ Створити персонажа</button>`}</div>`;
  return h;
}
// Живе оновлення підказки й кнопки без перемальовування (під час введення тексту)
function updateWizNav() {
  if (!S.wiz || cur().view !== 'create') return;
  const err = wizStepError();
  const box = document.getElementById('wizErr');
  const btn = document.getElementById('wizNext');
  if (box) { box.hidden = !err; box.textContent = err ? `⚠️ ${err}` : ''; }
  if (btn) btn.classList.toggle('dim', !!err);
}
// Скидаємо вибори, що залежать від змінених полів, щоб не лишалось «невидимих» старих виборів
function wizChanged(path) {
  const w = S.wiz;
  if (!w) return;
  const dropPicks = (pre) => { for (const k of Object.keys(w.profPicks)) if (k.startsWith(pre)) delete w.profPicks[k]; };
  if (path === 'wiz.classId') {
    Object.assign(w, { skills: [], expertise: [], subclassId: '', choices: {}, asi: {}, expertiseAt: {}, choicesUp: {}, equip: { gold: false, opts: [], picks: {} } });
    w.sp = { list: [], pool: '', q: '', lvl: 'all' };
    dropPicks('class:'); dropPicks('sub:');
  }
  if (path === 'wiz.raceId') { Object.assign(w, { raceChoice: [], raceSkills: [], choices: {}, choicesUp: {} }); dropPicks('race:'); w.sp.list = w.sp.list.filter((e) => e.pool !== 'raceCantrip'); }
  if (path === 'wiz.backgroundId') { w.bgSkills = []; dropPicks('bg:'); }
  if (path === 'wiz.subclassId') dropPicks('sub:');
  if (path === 'wiz.level') { w.choicesUp = {}; w.expertiseAt = {}; }
  const fm2 = path.match(/^wiz\.asi\.(\d+)\.feat\.id$/);
  if (fm2) Object.assign(w.asi[fm2[1]].feat, { ability: '', skills: [] });
}
function opts(map, val, placeholder) {
  return `<option value="">${placeholder}</option>${Object.entries(map).map(([k, v]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${esc(v.name || v)}</option>`).join('')}`;
}
function wizStep1() {
  const w = S.wiz;
  const race = R.RACES[w.raceId];
  const cls = R.CLASSES[w.classId];
  const bg = R.BACKGROUNDS[w.backgroundId];
  return `<div class="card">
    <label class="fld"><span>Ім’я персонажа</span><input data-bind="wiz.name" value="${esc(w.name)}" maxlength="60" placeholder="Напр. Арвен Тінь"></label>
    <label class="fld"><span>Раса</span><select data-bind="wiz.raceId" data-rerender>${opts(R.RACES, w.raceId, 'Обери расу')}</select></label>
    ${race ? `<small class="hint">${abbrify(`Бонуси: ${Object.entries(race.bonus).map(([a, v]) => `${R.ABILITY_SHORT[a]} +${v}`).join(', ')}${race.choose ? `, +1 до двох інших на вибір` : ''} · швидкість ${race.speed} фт${race.skills ? ` · ${race.skills.map((k) => R.SKILLS[k][0]).join(', ')}` : ''}${race.skillChoice ? ` · ${race.skillChoice} навички на вибір` : ''}`)}</small>` : ''}
    <label class="fld"><span>Клас</span><select data-bind="wiz.classId" data-rerender>${opts(R.CLASSES, w.classId, 'Обери клас')}</select></label>
    ${cls ? `<small class="hint">${abbrify(`Кість хітів к${cls.hd} · рятівні: ${cls.saves.map((a) => R.ABILITY_SHORT[a]).join(', ')} · навичок: ${cls.skillCount}${cls.caster !== 'none' ? ` · заклинач (${R.ABILITY_SHORT[cls.spellAbility]})` : ''}`)}</small>` : ''}
    <label class="fld"><span>Передісторія</span><select data-bind="wiz.backgroundId" data-rerender>${opts(R.BACKGROUNDS, w.backgroundId, 'Обери передісторію')}</select></label>
    ${bg ? `<small class="hint">${bg.choose ? 'Обереш 2 навички самостійно' : `Навички: ${bg.skills.map((k) => R.SKILLS[k][0]).join(', ')}`}</small>` : ''}
    <label class="fld"><span>Світогляд</span><select data-bind="wiz.alignment"><option value="">—</option>${R.ALIGNMENTS.map((a) => `<option value="${esc(a)}" ${a === w.alignment ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
    ${roomMaxLevel() > 1 ? `<label class="fld"><span>Початковий рівень</span><select data-bind="wiz.level" data-num data-rerender>
      ${Array.from({ length: roomMaxLevel() }, (_, i) => i + 1).map((l) => `<option value="${l}" ${l === wizLevel() ? 'selected' : ''}>${l} рівень${l > 1 ? ` (${R.XP_TABLE[l - 1]} досвіду)` : ''}</option>`).join('')}</select></label>
      <small class="hint">Майстер дозволив почати до ${roomMaxLevel()} рівня. Вибори розвитку зробиш на окремому кроці.</small>` : ''}
  </div>`;
}
function wizStep2() {
  const w = S.wiz;
  const race = R.RACES[w.raceId];
  const methods = [['standard', 'Стандартний набір'], ['pointbuy', 'Купівля очками'], ['roll', 'Кидок 4к6']];
  let h = `<div class="chips">${methods.map(([k, t]) => `<button class="chip ${w.method === k ? 'on' : ''}" data-act="wizMethod" data-m="${k}">${t}</button>`).join('')}</div>`;
  h += '<div class="card">';
  if (w.method === 'pointbuy') {
    h += `<p class="hint">Бюджет: <b>${R.POINT_BUY_TOTAL - pbSpent()}</b> з ${R.POINT_BUY_TOTAL} очок. Значення від 8 до 15.</p>`;
  } else if (w.method === 'roll') {
    h += w.rolls ? `<p class="hint">Твій кидок: <b>${w.rolls.join(', ')}</b>. Розподіли значення між характеристиками.</p>
      <button class="btn sm" data-act="roll">🎲 Перекинути</button> <small class="hint">кожен кидок бачить майстер у журналі</small>`
      : '<p class="hint">Кубики кидає сервер (4к6, без найменшого) — результат бачить майстер.</p><button class="btn primary block" data-act="roll">🎲 Кинути кубики</button>';
  } else {
    h += '<p class="hint">Розподіли значення 15, 14, 13, 12, 10, 8 між характеристиками.</p>';
  }
  const pool = wizPool();
  const base = wizBase();
  h += R.ABILITIES.map((a) => {
    let ctrl;
    if (w.method === 'pointbuy') {
      ctrl = `<div class="stepper"><button data-act="pb" data-a="${a}" data-d="-1">−</button><input value="${w.pb[a]}" readonly><button data-act="pb" data-a="${a}" data-d="1">+</button></div>`;
    } else {
      const taken = new Set(R.ABILITIES.filter((b) => b !== a && w.assign[b] !== undefined && w.assign[b] !== '').map((b) => String(w.assign[b])));
      ctrl = `<select data-bind="wiz.assign.${a}" data-rerender style="width:90px" ${pool.length ? '' : 'disabled'}><option value="">—</option>
        ${pool.map((v, i) => `<option value="${i}" ${String(w.assign[a]) === String(i) ? 'selected' : ''} ${taken.has(String(i)) ? 'disabled' : ''}>${v}</option>`).join('')}</select>`;
    }
    const bonus = (race.bonus[a] || 0) + (race.choose && w.raceChoice.includes(a) ? race.choose.amount : 0);
    const val = w.method === 'pointbuy' ? w.pb[a] : base ? base[a] : (w.assign[a] !== undefined && w.assign[a] !== '' ? pool[Number(w.assign[a])] : null);
    const total = val != null ? val + bonus : null;
    return `<div class="ln"><span style="min-width:96px">${R.ABILITY_NAMES[a]}</span>${ctrl}
      <span class="hint">${bonus ? `+${bonus}` : ''}</span><span class="v">${total != null ? `${total} (${fm(R.mod(total))})` : '—'}</span></div>`;
  }).join('');
  h += '</div>';
  if (race.choose) {
    h += `<div class="card"><h3>Бонус раси: +1 до двох характеристик</h3><div class="chips">${R.ABILITIES.filter((a) => !race.choose.exclude.includes(a))
      .map((a) => `<button class="chip ${w.raceChoice.includes(a) ? 'on' : ''}" data-act="wizRaceChoice" data-a="${a}">${R.ABILITY_NAMES[a]}</button>`).join('')}</div></div>`;
  }
  return h;
}
function pickList(list, keys, max, fixed = new Set()) {
  const sel = S.wiz[list];
  return R.sortSkills(keys).map((k) => {
    const isFixed = fixed.has(k);
    const on = sel.includes(k);
    const dis = isFixed || (!on && sel.length >= max);
    return `<div class="pick ${dis && !on ? 'disabled' : ''}" data-act="wizPick" data-list="${list}" data-k="${k}" data-max="${max}">
      <input type="checkbox" ${on || isFixed ? 'checked' : ''} tabindex="-1" style="pointer-events:none"><span>${R.SKILLS[k][0]} <span class="ab hint">${R.ABILITY_SHORT[R.SKILLS[k][1]]}</span></span>
      ${isFixed ? '<span class="v hint">вже є</span>' : ''}</div>`;
  }).join('');
}
function wizStep3() {
  const w = S.wiz;
  const race = R.RACES[w.raceId];
  const cls = R.CLASSES[w.classId];
  const bg = R.BACKGROUNDS[w.backgroundId];
  // прибираємо невалідні вибори
  const fixedBgRace = new Set([...(bg.choose ? [] : bg.skills), ...(race.skills || [])]);
  w.bgSkills = bg.choose ? w.bgSkills.filter((k) => !fixedBgRace.has(k)) : [];
  if (!race.skillChoice) w.raceSkills = [];
  const fixed = wizFixedSkills();
  w.raceSkills = w.raceSkills.filter((k) => !fixed.has(k));
  const allowed = cls.skills === 'any' ? R.SKILL_IDS : cls.skills;
  w.skills = w.skills.filter((k) => allowed.includes(k) && !fixed.has(k) && !w.raceSkills.includes(k));
  let h = '';
  h += `<div class="card"><h3>Передісторія: ${esc(bg.name)}</h3>`;
  h += bg.choose ? `<p class="hint">Обери ${bg.choose} навички (${w.bgSkills.length}/${bg.choose})</p>${pickList('bgSkills', R.SKILL_IDS, bg.choose, new Set(race.skills || []))}`
    : `<p class="hint">${bg.skills.map((k) => R.SKILLS[k][0]).join(', ')}</p>`;
  h += '</div>';
  if (race.skills || race.skillChoice) {
    h += `<div class="card"><h3>Раса: ${esc(race.name)}</h3>`;
    if (race.skills) h += `<p class="hint">${race.skills.map((k) => R.SKILLS[k][0]).join(', ')}</p>`;
    if (race.skillChoice) {
      const taken = new Set([...fixed, ...w.skills]);
      h += `<p class="hint">Обери ${race.skillChoice} будь-які навички (${w.raceSkills.length}/${race.skillChoice})</p>${pickList('raceSkills', R.SKILL_IDS, race.skillChoice, taken)}`;
    }
    h += '</div>';
  }
  const takenForClass = new Set([...fixed, ...w.raceSkills]);
  h += `<div class="card"><h3>Клас: ${esc(cls.name)}</h3><p class="hint">Обери ${cls.skillCount} навички (${w.skills.length}/${cls.skillCount})</p>
    ${pickList('skills', allowed, cls.skillCount, takenForClass)}</div>`;
  const exp = R.expertiseAt(w.classId, 1);
  if (exp) {
    const prof = [...new Set([...fixed, ...w.raceSkills, ...w.skills])];
    w.expertise = w.expertise.filter((k) => prof.includes(k));
    h += `<div class="card"><h3>Експертиза</h3><p class="hint">Подвоєний бонус майстерності для ${exp} навичок (${w.expertise.length}/${exp})</p>
      ${pickList('expertise', prof, exp)}</div>`;
  }
  const cd = R.CLASS_DATA[w.classId];
  if (cd && cd.subclassLevel === 1) h += subclassPickerHtml(w.classId, w.subclassId, 'wiz.subclassId');
  const pre = R.buildCharacter(wizInput({ choices: {}, level: 1 }), { partial: true }).sheet;
  if (pre && !R.subclassNeeded(pre, 1)) {
    const specs = R.pendingChoices(pre, 1);
    if (specs.length) h += `<h3 class="sec">Вибори 1 рівня</h3>${choicesHtml(specs, pre, 1, 'wiz.choices', w.choices)}`;
  }
  return h;
}
// Крок «Володіння й мови»
function profLinesHtml(p) {
  p = p || { armor: [], weapons: [], tools: [], languages: [] };
  const row = (label, arr, dict) => `<div class="ln" style="align-items:flex-start"><span style="min-width:96px">${label}</span><span class="grow">${arr.length ? esc(arr.map((x) => dict[x] || x).join(', ')) : '<span class="hint">—</span>'}</span></div>`;
  return row('Обладунки', p.armor, R.ARMOR_PROF) + row('Зброя', p.weapons, R.WEAPON_PROF) + row('Інструменти', p.tools, R.TOOLS) + row('Мови', p.languages, R.LANGUAGES);
}
function wizStepProf() {
  const w = S.wiz;
  const pre = wizPreview();
  const fixed = R.fixedProf(pre);
  let h = `<div class="lines"><h3>Вже маєш (раса, клас, передісторія)</h3>${profLinesHtml(fixed)}</div>`;
  for (const spec of R.profChoiceSpecs(pre)) {
    const sel = (w.profPicks[spec.id] = (w.profPicks[spec.id] || []).filter((x) => spec.from.includes(x)));
    const kindSuffix = spec.kind === 'tool' ? ':tool' : ':lang';
    const taken = new Set([...(spec.kind === 'tool' ? fixed.tools : fixed.languages),
      ...Object.entries(w.profPicks).filter(([k]) => k !== spec.id && k.endsWith(kindSuffix)).flatMap(([, v]) => v)]);
    const dict = spec.kind === 'tool' ? R.TOOLS : R.LANGUAGES;
    const chip = (id) => {
      const on = sel.includes(id);
      const dis = !on && (taken.has(id) || (sel.length >= spec.count && spec.count > 1));
      return `<button class="chip ${on ? 'on' : ''} ${dis ? 'muted' : ''}" data-act="pickChoice" data-path="wiz.profPicks" data-spec="${spec.id}" data-k="${id}" data-max="${spec.count}" ${taken.has(id) && !on ? 'disabled' : ''}>${esc(dict[id])}</button>`;
    };
    let body;
    if (spec.kind === 'tool') {
      const groups = Object.values(R.TOOL_GROUPS).map((g) => [g.name, g.ids.filter((id) => spec.from.includes(id))]).filter(([, ids]) => ids.length);
      body = groups.map(([name, ids]) => `${groups.length > 1 ? `<small class="hint">${esc(name)}</small>` : ''}<div class="chips wrap">${ids.map(chip).join('')}</div>`).join('');
    } else body = `<div class="chips wrap">${spec.from.map(chip).join('')}</div>`;
    h += `<div class="card"><h3>${esc(spec.name)}</h3><p class="hint">Обери ${spec.count} (${sel.length}/${spec.count})</p>${body}</div>`;
  }
  return h;
}

// Крок «Спорядження»
function equipPickSelects(opt, keyOf) {
  return opt.map(([id], ii) => {
    if (!R.PICKS[id]) return '';
    const key = keyOf(ii);
    const v = S.wiz.equip.picks[key] || '';
    return `<label class="fld" style="margin:2px 0 8px 30px"><span>${esc(R.PICKS[id].name)}</span><select data-bind="wiz.equip.picks.${key}" data-rerender><option value="">Обери…</option>
      ${R.PICKS[id].ids().map((x) => `<option value="${x}" ${v === x ? 'selected' : ''}>${esc(R.itemLabel(x))}</option>`).join('')}</select></label>`;
  }).join('');
}
function packHint(opt) {
  const packs = opt.filter(([id]) => R.PACKS[id]);
  return packs.map(([id]) => `<br><small class="hint">${esc(R.PACKS[id].map(([x, q]) => `${R.itemLabel(x)}${q > 1 ? ` ×${q}` : ''}`).join(', '))}</small>`).join('');
}
function wizStepEquip() {
  const w = S.wiz;
  const pre = wizPreview();
  const ce = R.CLASS_EQUIP[w.classId];
  const be = R.BG_EQUIP[w.backgroundId] || R.BG_EQUIP.custom;
  const eq = w.equip;
  let h = `<div class="chips wrap"><button class="chip ${!eq.gold ? 'on' : ''}" data-act="wizGold" data-v="0">🎒 Стартове спорядження</button>
    <button class="chip ${eq.gold ? 'on' : ''}" data-act="wizGold" data-v="1">🎲 Золото: ${esc(R.startGoldText(w.classId))}</button></div>`;
  if (eq.gold) {
    return `${h}<div class="card"><p class="hint">${abbrify(`Замість спорядження класу й передісторії отримаєш ${R.startGoldText(w.classId)}. Кидок зробить сервер під час створення, результат побачить майстер. Потрібні речі купиш у грі.`)}</p></div>`;
  }
  const letters = t('абв');
  ce.groups.forEach((g, gi) => {
    h += `<div class="card"><h3>Обери ${gi + 1}</h3>${g.map((opt, oi) => {
      const on = Number(eq.opts[gi]) === oi && eq.opts[gi] !== undefined && eq.opts[gi] !== null;
      const allowed = R.equipOptionAllowed(w.classId, `g${gi}o${oi}`, pre && pre.prof);
      return `<div class="pick ${allowed ? '' : 'disabled'}" data-act="wizEquipOpt" data-g="${gi}" data-o="${oi}"><input type="radio" ${on ? 'checked' : ''} tabindex="-1" style="pointer-events:none">
        <span class="grow">(${letters[oi]}) ${esc(R.optionLabel(opt))}${allowed ? '' : ' <small class="hint">— потрібне володіння</small>'}${packHint(opt)}</span></div>
        ${on ? equipPickSelects(opt, (ii) => `g${gi}o${oi}i${ii}`) : ''}`;
    }).join('')}</div>`;
  });
  if (ce.fixed.length) {
    h += `<div class="card"><h3>Також від класу</h3>${ce.fixed.map((e, i) => `<div class="ln" style="display:block">${esc(R.optionLabel([e]))}${packHint([e])}</div>${equipPickSelects([e], () => `f${i}`)}`).join('')}</div>`;
  }
  const bgTool = (w.profPicks['bg:tool'] || [])[0];
  h += `<div class="card"><h3>Від передісторії: ${esc((R.BACKGROUNDS[w.backgroundId] || {}).name || '')}</h3>
    ${be.items.map(([id, q]) => `<div class="ln">${id === '@bgtool' ? (bgTool ? esc(R.itemLabel(bgTool)) : '<span class="hint">інструмент, обраний у володіннях</span>') : esc(R.itemLabel(id))}${q > 1 ? ` ×${q}` : ''}</div>`).join('')}
    <div class="ln"><span class="grow">Гроші</span><span class="v">${be.gp} ${ab('ЗМ')}</span></div></div>
    <p class="hint center">Обладунок, щит і зброю буде одразу екіпіровано.</p>`;
  return h;
}

// Крок «Розвиток»: підклас, ПХ/риси, експертиза та вибори класу до обраного рівня
function wizStepLevels() {
  const w = S.wiz;
  const N = wizLevel();
  const cls = R.CLASSES[w.classId];
  const cd = R.CLASS_DATA[w.classId];
  const snaps = {};
  const full = R.buildCharacter(wizInput(), { snaps, partial: true });
  const sheet = full.sheet;
  let h = `<div class="card"><p class="hint">${abbrify(`Персонаж починає з ${N} рівня (${R.XP_TABLE[N - 1]} досвіду). Хіти: максимум кості на 1 рівні, далі середнє к${cls.hd}.`)}</p>
    ${sheet && sheet.hp ? `<div class="stats"><div class="stat"><small>Хіти</small><b>${sheet.hp.max}</b></div><div class="stat"><small>${ab('Майст.')}</small><b>${fm(R.profBonus(N))}</b></div>
    ${R.isCaster(sheet) ? `<div class="stat"><small>Комірки</small><b>${R.sheetSlots(sheet).filter(Boolean).join('/') || '—'}</b></div>` : ''}</div>` : ''}</div>`;
  // Підклас (якщо він з'являється після 1 рівня)
  if (cd && cd.subclassLevel > 1 && cd.subclassLevel <= N) {
    h += `<h3 class="sec">${cd.subclassLevel} рівень</h3>${subclassPickerHtml(w.classId, w.subclassId, 'wiz.subclassId')}`;
  }
  // Підвищення характеристик / риси та експертиза по рівнях
  for (let L = 2; L <= N; L++) {
    const snap = snaps[L];
    if (!snap) continue;
    if (R.isAsiLevel(w.classId, L)) {
      const a = (w.asi[L] = w.asi[L] || { mode: 'asi', asi: {}, feat: { id: '', ability: '', skills: [] } });
      h += `<div class="card"><h3>${L} рівень: підвищення характеристик або риса</h3><div class="chips">
        <button class="chip ${a.mode === 'asi' ? 'on' : ''}" data-act="wizAsiMode" data-l="${L}" data-m="asi">+2 до характеристик</button>
        <button class="chip ${a.mode === 'feat' ? 'on' : ''}" data-act="wizAsiMode" data-l="${L}" data-m="feat">Риса</button></div>`;
      if (a.mode === 'asi') {
        const sum = Object.values(a.asi).reduce((t, v) => t + v, 0);
        h += `<p class="hint">Розподіли 2 очки: +2 до однієї або +1 до двох. Максимум 20. Використано: ${sum}/2</p>
        ${R.ABILITIES.map((k) => { const v = a.asi[k] || 0; const base = snap.abilities[k]; return `<div class="ln"><span class="grow">${R.ABILITY_NAMES[k]} <span class="hint">${base}${v ? ` → ${base + v}` : ''}</span></span>
          <div class="stepper"><button data-act="wizAsi" data-l="${L}" data-a="${k}" data-d="-1">−</button><input value="${v ? '+' + v : '0'}" readonly style="width:50px"><button data-act="wizAsi" data-l="${L}" data-a="${k}" data-d="1">+</button></div></div>`; }).join('')}`;
      } else {
        const fo = R.featOptions(snap);
        const feat = R.FEATS.find((x) => x.id === a.feat.id);
        h += `<label class="fld"><span>Риса</span><select data-bind="wiz.asi.${L}.feat.id" data-rerender><option value="">Обери рису…</option>
          ${fo.map((x) => `<option value="${x.id}" ${a.feat.id === x.id ? 'selected' : ''} ${x.disabled && a.feat.id !== x.id ? 'disabled' : ''}>${esc(x.name)}${x.reason ? ` (${esc(x.reason)})` : ''}</option>`).join('')}</select></label>`;
        if (feat) {
          h += `<p class="textblock">${abbrify(feat.desc)}</p>`;
          if (feat.asi && feat.asi.length > 1) {
            h += `<p class="hint">Яку характеристику підвищити на +1?</p><div class="chips">${feat.asi.map((k) => `<button class="chip ${a.feat.ability === k ? 'on' : ''} ${snap.abilities[k] >= 20 ? 'muted' : ''}" data-act="wizFeatAbility" data-l="${L}" data-a="${k}">${R.ABILITY_NAMES[k]} (${snap.abilities[k]})</button>`).join('')}</div>`;
          }
          if (feat.effect === 'skilled') {
            const sel = a.feat.skills || [];
            h += `<p class="hint">Обери 3 навички (${sel.length}/3)</p>${R.SKILL_IDS.map((k) => {
              const on = sel.includes(k); const dis = (!!snap.skills[k] && !on) || (!on && sel.length >= 3);
              return `<div class="pick ${dis ? 'disabled' : ''}" data-act="pickChoice" data-path="wiz.asi.${L}.feat" data-spec="skills" data-k="${k}" data-max="3"><input type="checkbox" ${on ? 'checked' : ''} tabindex="-1" style="pointer-events:none"><span>${R.SKILLS[k][0]}</span>${snap.skills[k] && !on ? '<span class="v hint">вже є</span>' : ''}</div>`;
            }).join('')}`;
          }
        }
      }
      h += '</div>';
    }
    const expN = R.expertiseAt(w.classId, L);
    if (expN) {
      const sel = (w.expertiseAt[L] = (w.expertiseAt[L] || []).filter((k) => snap.skills[k] === 1));
      const other = new Set(Object.entries(w.expertiseAt).filter(([l]) => Number(l) !== L).flatMap(([, v]) => v));
      const prof = R.SKILL_IDS.filter((k) => snap.skills[k] === 1);
      h += `<div class="card"><h3>${L} рівень: експертиза</h3><p class="hint">Подвоєний бонус майстерності для ${expN} навичок (${sel.length}/${expN})</p>${prof.map((k) => {
        const on = sel.includes(k);
        const dis = !on && (other.has(k) || sel.length >= expN);
        return `<div class="pick ${dis ? 'disabled' : ''}" data-act="pickChoice" data-path="wiz.expertiseAt" data-spec="${L}" data-k="${k}" data-max="${expN}"><input type="checkbox" ${on ? 'checked' : ''} tabindex="-1" style="pointer-events:none"><span>${R.SKILLS[k][0]}</span>${other.has(k) && !on ? '<span class="v hint">на іншому рівні</span>' : ''}</div>`;
      }).join('')}</div>`;
    }
  }
  // Накопичені вибори класу й підкласу (бойові стилі, виклики, метамагія тощо)
  const pre = R.buildCharacter(wizInput({ choicesUp: {} }), { partial: true }).sheet;
  if (pre && !R.subclassNeeded(pre, N)) {
    const specs = R.pendingChoices(pre, N);
    if (specs.length) {
      // для перевірки доступності враховуємо вибори інших пунктів (напр. дар договору для викликів)
      const optSheet = (spec) => {
        const ch = { ...(pre.choices || {}) };
        for (const [id, v] of Object.entries(w.choicesUp)) if (id !== spec.id) ch[id] = [...(ch[id] || []), ...v];
        return { ...pre, choices: ch };
      };
      h += `<h3 class="sec">Вибори до ${N} рівня</h3>${choicesHtml(specs, optSheet, N, 'wiz.choicesUp', w.choicesUp)}`;
    }
  }
  if (sheet) {
    const gained = (sheet.features || []).map((x, i) => ({ ...x, _i: i })).filter((x) => x.lvl > 1);
    if (gained.length) h += `<div class="lines"><h3>Вміння 2–${N} рівнів</h3>${featureListHtml(gained, { showLvl: true })}</div>`;
  }
  return h;
}
function wizStep4() {
  const w = S.wiz;
  const { sheet } = R.buildCharacter(wizInput(), { partial: true });
  let h = '';
  if (sheet) {
    const dv = { ac: R.computeAC(sheet, []), prof: R.sheetProf(sheet) };
    h += `<div class="char-head"><div class="emb" aria-hidden="true"></div><div class="nm">${CLASS_ICON[sheet.classId]} ${esc(sheet.name)}</div><div class="sub">${esc(raceName(sheet))} · ${esc(className(sheet))}${sheet.subclass ? ` (${esc(sheet.subclass)})` : ''} · ${sheet.level} рівень</div></div>
    <div class="stats"><div class="stat"><small>Хіти</small><b>${sheet.hp.max}</b></div><div class="stat"><small>${ab('КЗ')}</small><b>${dv.ac}</b></div>
    <div class="stat"><small>${ab('Ініціат.')}</small><b>${fm(R.mod(sheet.abilities.dex))}</b></div><div class="stat"><small>${ab('Швидк.')}</small><b>${sheet.speed}</b></div>
    <div class="stat"><small>${ab('Майст.')}</small><b>${fm(dv.prof)}</b></div></div>
    <div class="abil mt">${R.ABILITIES.map((a) => `<div class="box"><small>${ab(R.ABILITY_SHORT[a])}</small><div class="m">${fm(R.mod(sheet.abilities[a]))}</div><span class="s">${sheet.abilities[a]}</span></div>`).join('')}</div>
    <div class="card"><small class="hint">Навички: ${Object.keys(sheet.skills).map((k) => R.SKILLS[k][0] + (sheet.skills[k] === 2 ? ' (експ.)' : '')).join(', ')}</small></div>
    <div class="lines"><h3>Вміння та риси</h3>${featureListHtml(sheet.features || [], { showSrc: true, showLvl: sheet.level > 1 })}</div>
    <div class="lines"><h3>Володіння та мови</h3>${profLinesHtml(sheet.prof)}</div>`;
    const sp = (w.sp.list || []).map((e) => R.SPELLS[e.sid]).filter(Boolean);
    if (sp.length) h += `<div class="card"><small class="hint">Закляття: ${esc(sp.map((x) => x.name).join(', '))}</small></div>`;
    const eq = wizEquipResult();
    h += `<div class="card"><small class="hint">${eq.gold ? `Золото замість спорядження: ${esc(R.startGoldText(w.classId))} (кидок під час створення)`
      : `Спорядження: ${esc(eq.items.map(([id, q]) => `${R.itemLabel(id)}${q > 1 ? ` ×${q}` : ''}`).join(', '))}; ${eq.gp} ЗМ`}</small></div>`;
  }
  h += `<div class="card"><h3>Опис (можна заповнити пізніше)</h3>
    <label class="fld"><span>Зовнішність</span><textarea data-bind="wiz.text.appearance" maxlength="4000">${esc(w.text.appearance || '')}</textarea></label>
    <label class="fld"><span>Риси характеру</span><textarea data-bind="wiz.text.personality" maxlength="4000">${esc(w.text.personality || '')}</textarea></label>
    <label class="fld"><span>Передісторія персонажа</span><textarea data-bind="wiz.text.backstory" maxlength="4000">${esc(w.text.backstory || '')}</textarea></label>
    <label class="fld"><span>Нотатки до володінь</span><textarea data-bind="wiz.text.proficiencies" maxlength="4000" placeholder="Додаткові володіння, якщо майстер дозволив">${esc(w.text.proficiencies || '')}</textarea></label></div>`;
  return h;
}

// ---------- Каталог ----------
const CAT_GROUPS = [['all', 'Усі'], ['mine', 'Мої предмети'], ['weapon', 'Зброя'], ['armor', 'Обладунки'], ['gear', 'Спорядження'], ['potion', 'Зілля'], ['magic', 'Магічні'], ['tool', 'Інструменти'], ['treasure', 'Скарби']];
function myCatalog() {
  return (S.myItems || []).map((x) => ({ ...x.data, catalogId: `my_${x.id}`, myId: x.id, group: 'Мої предмети', srcId: x.data.catalogId }));
}
function catalogFiltered() {
  const { q, group, rarity } = S.cat;
  const ql = q.trim().toLowerCase();
  return [...myCatalog(), ...CATALOG].filter((it) => {
    if (group === 'mine' && !it.myId) return false;
    if (rarity !== 'all' && it.rarity !== rarity) return false;
    if (group === 'weapon' && it.type !== 'weapon') return false;
    if (group === 'armor' && !['armor', 'shield'].includes(it.type)) return false;
    if (group === 'gear' && !['gear', 'ammo', 'food'].includes(it.type)) return false;
    if (group === 'potion' && it.type !== 'potion') return false;
    if (group === 'magic' && it.group !== 'Магічні предмети') return false;
    if (group === 'tool' && it.type !== 'tool') return false;
    if (group === 'treasure' && it.type !== 'treasure') return false;
    return !ql || it.name.toLowerCase().includes(ql) || (it.desc || '').toLowerCase().includes(ql)
      || (D && (t(it.name).toLowerCase().includes(ql) || t(it.desc || '').toLowerCase().includes(ql)));
  });
}
function catalogListHtml() {
  const list = catalogFiltered();
  if (!list.length) return empty('🔍', 'Нічого не знайдено');
  return list.map((it) => `<div class="item rc-${esc(it.rarity)}" data-act="catPick" data-id="${esc(it.catalogId)}"><span class="ic">${ITEM_ICON[it.type] || '📦'}</span>
    <div class="meta"><div class="nm">${esc(it.name)}${it.myId ? ' <span class="badge gold">мій</span>' : ''}</div><small>${esc([R.RARITIES[it.rarity] ? R.RARITIES[it.rarity].name : '', itemSub(it), it.cost, it.attune && 'налаштування'].filter(Boolean).join(' · '))}</small></div></div>`).join('');
}
// Ефекти в каталозі: свої (редагуються) і стандартні 5e (довідка)
function catalogEffectsHtml() {
  const mine = S.myEffects;
  const row = (act, id, icon, name, sub, std) => `<div class="item" data-act="${act}" data-${std ? 'k' : 'id'}="${esc(id)}"><span class="ic">${esc(icon)}</span>
    <div class="meta"><div class="nm"${std ? '' : ' data-notr'}>${esc(name)}${std ? '' : ' <span class="badge gold" data-notr>' + esc(t('мій')) + '</span>'}</div>${sub ? `<small${std ? '' : ' data-notr'}>${esc(sub)}</small>` : ''}</div></div>`;
  return `<h3 class="sec">Мої ефекти</h3>
    ${mine === null ? '<div class="spinner" style="margin:8px auto;width:20px;height:20px"></div>'
      : mine.length ? mine.map((x) => row('fxEditMine', x.id, x.data.icon, x.data.name, x.data.desc ? x.data.desc.slice(0, 90) : '', false)).join('')
        : empty('✨', 'Своїх ефектів ще немає')}
    <h3 class="sec">Стандартні ефекти D&D 5e</h3>
    ${R.EFFECT_GROUPS.map(([g, gn]) => `<div class="fld"><span>${gn}</span></div>${Object.entries(R.EFFECTS).filter(([, d]) => d.g === g).map(([k, d]) => row('fxStdInfo', k, d.icon, d.name, '', true)).join('')}`).join('')}`;
}
function catalogHtml() {
  const manage = !cur().charId;
  const ch = manage ? null : currentChar();
  if (manage && S.cat.kind === 'effects') {
    return `<div class="top"><h2>📦 Каталог</h2></div>
    <div class="btns cat-new"><button class="btn" data-act="myNewItem">＋ Створити предмет</button><button class="btn primary" data-act="fxNew">＋ Створити ефект</button></div>
    <div class="tabs cat-kind"><button data-act="catKind" data-k="items">🎒 Предмети</button><button class="on" data-act="catKind" data-k="effects">✨ Ефекти</button></div>
    <p class="hint" style="margin:4px">Свої ефекти доступні у всіх твоїх кімнатах: на листі персонажа — «＋ Додати статус».</p>
    ${catalogEffectsHtml()}`;
  }
  return `<div class="top"><h2>${manage ? '📦 Каталог' : '🎁 Видати предмет'}</h2></div>
  ${manage ? `<div class="btns cat-new"><button class="btn primary" data-act="myNewItem">＋ Створити предмет</button><button class="btn" data-act="fxNew">＋ Створити ефект</button></div>
    <div class="tabs cat-kind"><button class="on" data-act="catKind" data-k="items">🎒 Предмети</button><button data-act="catKind" data-k="effects">✨ Ефекти</button></div>` : ''}
  <p class="hint" style="margin:4px">${manage ? 'D&D 5e (SRD) і твої власні предмети. Власні доступні у всіх твоїх кімнатах. Натисни на предмет D&D, щоб зберегти його змінену копію.'
    : `Персонаж: <b>${ch ? esc(ch.sheet.name) : ''}</b>`}</p>
  ${S.myItems === null ? '<div class="spinner" style="margin:8px auto;width:20px;height:20px"></div>' : ''}
  <input data-bind="cat.q" data-live="catalog" value="${esc(S.cat.q)}" placeholder="🔍 Пошук: меч, зілля, плащ…" class="mt">
  <div class="chips">${CAT_GROUPS.map(([k, t]) => `<button class="chip ${S.cat.group === k ? 'on' : ''}" data-act="catGroup" data-g="${k}">${t}</button>`).join('')}</div>
  <div class="chips"><button class="chip ${S.cat.rarity === 'all' ? 'on' : ''}" data-act="catRarity" data-r="all">Будь-яка рідкість</button>
  ${R.RARITY_IDS.map((k) => `<button class="chip rc-${k} ${S.cat.rarity === k ? 'on' : ''}" data-act="catRarity" data-r="${k}"><span class="rname">${R.RARITIES[k].name}</span></button>`).join('')}</div>
  ${manage ? '' : '<button class="btn block mt" data-act="customItem">＋ Створити свій предмет</button>'}
  <div id="catList">${catalogListHtml()}</div>`;
}

// ---------- Редактор майстра ----------
function numIn(path, val, extra = '') {
  return `<input type="number" inputmode="numeric" data-bind="${path}" data-num value="${val === null || val === undefined ? '' : esc(val)}" ${extra}>`;
}
function editSheetHtml() {
  const e = S.edit;
  const ch = currentChar();
  if (!e || !ch) return loadingHtml();
  const auto = R.sheetSlots({ ...e, spell: { ...e.spell, slotsOverride: null } });
  return `<div class="top"><h2>✏️ ${esc(ch.sheet.name)}</h2></div>
  <p class="hint" style="margin:4px">Майстер може змінювати будь-які значення без обмежень правил. Гравець отримає сповіщення.</p>
  <div class="card"><h3>Основне</h3>
    <label class="fld"><span>Ім’я</span><input data-bind="edit.name" value="${esc(e.name)}" maxlength="60"></label>
    <div class="grid2"><label class="fld"><span>Раса</span><select data-bind="edit.raceId" data-rerender>${opts(R.RACES, e.raceId, '—')}<option value="custom" ${e.raceId === 'custom' ? 'selected' : ''}>Інша…</option></select></label>
    <label class="fld"><span>Клас</span><select data-bind="edit.classId" data-rerender>${opts(R.CLASSES, e.classId, '—')}</select></label></div>
    ${e.raceId === 'custom' ? `<label class="fld"><span>Назва раси</span><input data-bind="edit.raceName" value="${esc(e.raceName || '')}" maxlength="60"></label>` : ''}
    <div class="grid2"><label class="fld"><span>${esc((R.CLASS_DATA[e.classId] || {}).subclassLabel || 'Підклас')}</span><select data-bind="edit.subclassId"><option value="">—</option>
      ${Object.entries((R.CLASS_DATA[e.classId] || { subclasses: {} }).subclasses).map(([id, sc]) => `<option value="${id}" ${e.subclassId === id ? 'selected' : ''}>${esc(sc.name)}</option>`).join('')}</select>
      ${e.subclass && !e.subclassId ? `<small class="hint">Зараз: ${esc(e.subclass)}</small>` : ''}</label>
    <label class="fld"><span>Передісторія</span><select data-bind="edit.backgroundId">${opts(R.BACKGROUNDS, e.backgroundId, '—')}</select></label></div>
    <label class="fld"><span>Світогляд</span><select data-bind="edit.alignment"><option value="">—</option>${R.ALIGNMENTS.map((a) => `<option value="${esc(a)}" ${a === e.alignment ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
    <div class="grid3"><label class="fld"><span>Рівень</span>${numIn('edit.level', e.level, 'min="1" max="20"')}</label>
    <label class="fld"><span>Досвід</span>${numIn('edit.xp', e.xp, 'min="0"')}</label>
    <label class="fld"><span>Дозволений рів.</span>${numIn('edit.targetLevel', e.targetLevel, 'min="1" max="20"')}</label></div></div>
  <div class="card"><h3>Характеристики</h3><div class="grid3">${R.ABILITIES.map((a) => `<label class="fld"><span>${R.ABILITY_NAMES[a]}</span>${numIn(`edit.abilities.${a}`, e.abilities[a], 'min="1" max="30"')}</label>`).join('')}</div>
    <h3 class="mt">Рятівні кидки (володіння)</h3><div class="grid3">${R.ABILITIES.map((a) => `<label class="row" style="padding:6px 0"><input type="checkbox" data-arr="edit.saves" data-v="${a}" ${e.saves.includes(a) ? 'checked' : ''}><span>${R.ABILITY_SHORT[a]}</span></label>`).join('')}</div></div>
  <div class="card"><h3>Навички</h3>${R.SKILL_IDS.map((k) => `<div class="ln"><span class="grow">${R.SKILLS[k][0]}</span>
    <select data-bind="edit.skills.${k}" data-num style="width:150px">${['—', 'Володіння', 'Експертиза'].map((t, i) => `<option value="${i}" ${(e.skills[k] || 0) === i ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`).join('')}</div>
  <div class="card"><h3>Бій</h3>
    <div class="grid3"><label class="fld"><span>Макс. ХП</span>${numIn('edit.hp.max', e.hp.max)}</label><label class="fld"><span>Поточні ХП</span>${numIn('edit.hp.cur', e.hp.cur)}</label>
    <label class="fld"><span>Тимчасові ХП</span>${numIn('edit.hp.temp', e.hp.temp)}</label></div>
    <div class="grid3"><label class="fld"><span>Швидкість</span>${numIn('edit.speed', e.speed)}</label><label class="fld"><span>Бонус КЗ</span>${numIn('edit.acBonus', e.acBonus)}</label>
    <label class="fld"><span>КЗ вручну</span>${numIn('edit.acOverride', e.acOverride, 'placeholder="авто"')}</label></div>
    <div class="grid3"><label class="fld"><span>Бонус ініціат.</span>${numIn('edit.initBonus', e.initBonus)}</label><label class="fld"><span>Майстерність</span>${numIn('edit.profOverride', e.profOverride, 'placeholder="авто"')}</label>
    <label class="fld"><span>Витр. кості хітів</span>${numIn('edit.hitDiceUsed', e.hitDiceUsed)}</label></div>
    <div class="grid3"><label class="fld"><span>Успіхи від смерті</span>${numIn('edit.deathSaves.s', e.deathSaves.s)}</label><label class="fld"><span>Провали від смерті</span>${numIn('edit.deathSaves.f', e.deathSaves.f)}</label>
    <label class="fld"><span>Натхнення ⭐</span>${numIn('edit.inspiration', R.inspCount(e), 'min="0" max="99"')}</label></div></div>
  <div class="card"><h3>Володіння</h3>
    ${profEditHtml(e)}</div>
  <div class="card"><h3>Закляття</h3>
    <label class="fld"><span>Заклинальна характеристика</span><select data-bind="edit.spell.ability"><option value="">Авто (за класом)</option>${R.ABILITIES.map((a) => `<option value="${a}" ${e.spell.ability === a ? 'selected' : ''}>${R.ABILITY_NAMES[a]}</option>`).join('')}</select></label>
    <label class="row fld"><input type="checkbox" data-act="toggleSlotsOverride" ${Array.isArray(e.spell.slotsOverride) ? 'checked' : ''}><span>Задати комірки вручну (авто: ${auto.join('/') || 'немає'})</span></label>
    ${Array.isArray(e.spell.slotsOverride) ? `<div class="grid3">${Array.from({ length: 9 }, (_, i) => `<label class="fld"><span>${i + 1} коло</span>${numIn(`edit.spell.slotsOverride.${i}`, e.spell.slotsOverride[i] || 0)}</label>`).join('')}</div>` : ''}</div>
  <button class="btn primary block mt2" data-act="saveSheetEdit">💾 Зберегти зміни</button>`;
}

function profEditHtml(e) {
  const box = (arr, id, label) => `<label class="row" style="padding:5px 0"><input type="checkbox" data-arr="edit.prof.${arr}" data-v="${id}" ${e.prof[arr].includes(id) ? 'checked' : ''}><span>${esc(label)}</span></label>`;
  const specific = Object.keys(R.WEAPON_PROF).filter((k) => !['simple', 'martial'].includes(k));
  return `<small class="hint">Обладунки</small><div class="grid2">${Object.entries(R.ARMOR_PROF).map(([k, v]) => box('armor', k, v)).join('')}</div>
    <small class="hint">Зброя</small><div class="grid2">${box('weapons', 'simple', 'Проста зброя')}${box('weapons', 'martial', 'Військова зброя')}</div>
    <details class="mt"><summary class="hint">Окремі види зброї (${e.prof.weapons.filter((k) => specific.includes(k)).length})</summary><div class="grid2">${specific.map((k) => box('weapons', k, R.WEAPON_PROF[k])).join('')}</div></details>
    <details class="mt"><summary class="hint">Інструменти (${e.prof.tools.length})</summary>${Object.values(R.TOOL_GROUPS).map((g) => `<small class="hint">${esc(g.name)}</small><div class="grid2">${g.ids.map((k) => box('tools', k, R.TOOLS[k])).join('')}</div>`).join('')}</details>
    <details class="mt"><summary class="hint">Мови (${e.prof.languages.length})</summary><div class="grid2">${Object.entries(R.LANGUAGES).map(([k, v]) => box('languages', k, v)).join('')}</div></details>`;
}

// ---------- Журнал ----------
function logHtml() {
  const L = S.log;
  const fmt = (ts) => new Date(ts * 1000).toLocaleString(LOCALES[LANG], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `<div class="top"><h2>📜 Журнал</h2></div>
  <div class="chips"><button class="chip ${!S.logAll ? 'on' : ''}" data-act="logToggle" data-all="0">Поточна сесія</button><button class="chip ${S.logAll ? 'on' : ''}" data-act="logToggle" data-all="1">Увесь журнал</button></div>
  <div class="btns"><button class="btn" data-act="exportLog">📥 Надіслати .txt у чат</button><button class="btn" data-act="endSession">🏁 Завершити сесію</button></div>
  <div class="card">${!L ? '<div class="spinner" style="margin:20px auto"></div>' : L.entries.length ? L.entries.map((e) => (e.summary
    // підсумок завершеної сесії (вже мовою користувача)
    ? `<details class="log-e log-sum"><summary><small>${fmt(e.ts)} · сесія ${e.session}</small><b>📜 Підсумок сесії ${e.session}</b></summary><pre data-notr>${esc(e.summary.slice(1).join('\n').trim())}</pre></details>`
    : `<div class="log-e"><small>${fmt(e.ts)}${S.logAll ? ` · сесія ${e.session}` : ''} · ${esc(e.actor)}</small>${esc(e.text)}</div>`)).join('') : empty('📜', 'Записів поки немає')}</div>`;
}

// ================= Модальні вікна =================
// Тривалість ефекту: лічильник і одиниці (для виснаження — рівень 1–6)
function fxDurEditor(m, lvl) {
  if (lvl) {
    return `<div class="row fld fx-dur"><span class="grow">Рівень виснаження</span><div class="stepper"><button data-act="fxN" data-d="-1">−</button><b>${m.n}</b><button data-act="fxN" data-d="1">+</button></div></div>`;
  }
  return `<div class="fld"><span>Тривалість</span></div>
    <div class="chips wrap">${FX_UNIT_NAMES.map(([k, n]) => `<button class="chip ${m.unit === k ? 'on' : ''}" data-act="fxUnit" data-k="${k}">${n}</button>`).join('')}</div>
    ${m.unit !== 'perm' ? `<div class="row fld fx-dur"><span class="grow">Скільки</span><div class="stepper"><button data-act="fxN" data-d="-1">−</button>
      <input type="number" inputmode="numeric" class="fx-n-in" data-bind="modal.n" data-num min="1" max="999" value="${m.n}"><button data-act="fxN" data-d="1">+</button></div></div>` : ''}`;
}
const MODALS = {
  // Накласти статус на персонажа: стандартні ефекти 5e або свої з каталогу
  fxAdd: (m) => {
    const ch = currentChar();
    const mine = S.myEffects || [];
    const pick = (id, icon, name, std) => `<button class="fx-pick ${m.sel === id ? 'on' : ''}" data-act="fxPick" data-id="${id}"><span>${esc(icon)}</span> <span${std ? '' : ' data-notr'}>${esc(name)}</span></button>`;
    const [kind, id] = String(m.sel || '').split(':');
    const def = kind === 'k' ? R.EFFECTS[id] : null;
    const my = kind === 'm' ? (mine.find((x) => String(x.id) === id) || {}).data : null;
    const has = def && ch && (ch.effects || []).some((e) => e.key === id);
    return `${hdr('＋ Додати статус', ch ? esc(ch.sheet.name) : '')}
      ${R.EFFECT_GROUPS.map(([g, gn]) => `<div class="fld"><span>${gn}</span></div><div class="fx-picks">${Object.entries(R.EFFECTS).filter(([, d]) => d.g === g).map(([k, d]) => pick(`k:${k}`, d.icon, d.name, true)).join('')}</div>`).join('')}
      <div class="fld"><span>Мої ефекти</span></div>
      ${S.myEffects === null ? '<div class="spinner" style="margin:8px auto;width:20px;height:20px"></div>'
        : mine.length ? `<div class="fx-picks">${mine.map((x) => pick(`m:${x.id}`, x.data.icon, x.data.name, false)).join('')}</div>`
          : '<p class="hint">Своїх ефектів ще немає. Створи їх у «📦 Каталог» → «＋ Створити ефект».</p>'}
      ${def || my ? `<div class="card fx-sel"><b>${esc((def || my).icon)} <span${def ? '' : ' data-notr'}>${esc((def || my).name)}</span></b>
        ${(def || my).desc ? `<p class="hint"${def ? '' : ' data-notr'}>${esc((def || my).desc)}</p>` : ''}
        ${has ? '<small class="hint">Вже діє на персонажі — тривалість оновиться.</small>' : ''}</div>
        ${fxDurEditor(m, def && def.def.unit === 'lvl')}
        <button class="btn primary block mt2" data-act="fxApply">✨ Накласти</button>` : '<p class="hint mt">Обери ефект зі списку.</p>'}`;
  },
  // Свій ефект у каталозі майстра
  fxEdit: (m) => `${hdr(m.id ? '✏️ Мій ефект' : '＋ Новий ефект', 'Твій каталог — спільний для всіх кімнат')}
    <label class="fld"><span>Назва</span><input data-bind="modal.form.name" maxlength="60" placeholder="Напр. Прокляття мумії" value="${esc(m.form.name)}"></label>
    <div class="fld"><span>Значок</span></div>
    <div class="chips wrap fx-icons">${FX_ICONS.map((i) => `<button class="chip ${m.form.icon === i ? 'on' : ''}" data-act="fxIcon" data-i="${i}">${i}</button>`).join('')}
      <input class="fx-icon-in" data-bind="modal.form.icon" maxlength="8" value="${esc(m.form.icon)}" aria-label="${esc(t('Свій значок'))}"></div>
    <label class="fld"><span>Опис</span><textarea data-bind="modal.form.desc" rows="5" maxlength="1500" placeholder="Що робить ефект, як знімається…">${esc(m.form.desc)}</textarea></label>
    ${fxDurEditor(m, false)}
    <p class="hint">Тривалість за замовчуванням — під час накладання її можна змінити.</p>
    <button class="btn primary block mt2" data-act="fxSave">💾 Зберегти в каталог</button>
    ${m.id ? '<button class="btn danger block mt" data-act="fxDelete">🗑 Видалити з каталогу</button>' : ''}`,
  invite: () => {
    const r = S.room.room;
    const link = inviteLink(r.id);
    return `${hdr('📨 Запросити гравців')}<p class="hint">Надішли посилання гравцям — воно відкриє бота з кнопкою входу в кімнату. Або скажи код.</p>
    <div class="card center"><small>Код кімнати</small><div class="code" style="font-size:30px">${esc(r.id)}</div><small style="word-break:break-all">${esc(link)}</small></div>
    <div class="btns"><button class="btn primary" data-act="shareInvite">Поділитися в Telegram</button><button class="btn" data-act="copy" data-text="${esc(link)}">Копіювати</button></div>`;
  },

  roomSettings: (m) => `${hdr('⚙️ Налаштування кімнати')}
    <label class="fld"><span>Назва</span><input data-bind="modal.name" value="${esc(m.name)}" maxlength="60"></label>
    <div class="card">${startLevelHtml('modal.pick', m.pick, 'modal.max', m.max, 'modal')}</div>
    <button class="btn primary block mt" data-act="renameRoom">Зберегти</button>
    <button class="btn danger block mt2" data-act="deleteRoomForm">🗑 Видалити кімнату</button>`,

  deleteRoom: (m) => `${hdr('🗑 Закрити кімнату', esc(S.room.room.name))}
    <p class="hint">Напиши останнє повідомлення гравцям — воно прийде їм у Telegram. Персонажі збережуться в їхньому архіві.</p>
    <label class="fld"><span>Останнє слово майстра</span><textarea data-bind="modal.text" maxlength="1500" placeholder="Дякую за пригоди! Ваші імена вже співають барди…">${esc(m.text)}</textarea></label>
    <button class="btn danger block mt2" data-act="deleteRoom">Закрити кімнату й надіслати</button>`,

  roomMenu: () => {
    const d = S.room;
    return `${hdr(esc(d.room.name), `Код ${esc(d.room.id)} · майстер ${esc(d.room.masterName)}`)}
    ${d.fallen && d.fallen.length ? `<h3 class="sec">☠ Загиблі персонажі</h3>${d.fallen.map((f) => `<div class="ln">${esc(f.name)} <span class="v hint">${f.level} рів.</span></div>`).join('')}` : ''}
    <button class="btn block mt" data-act="toHome">🏠 До списку кімнат</button>
    <button class="btn danger block mt" data-act="leaveRoom">🚪 Вийти з кімнати</button>`;
  },

  hp: (m) => {
    const ch = currentChar();
    if (!ch) return null;
    const s = ch.sheet;
    const M = isMaster();
    return `${hdr('❤️ Хіти та стан', `${esc(s.name)}`)}
    <div class="stats" style="grid-template-columns:repeat(3,1fr)"><div class="stat"><small>Поточні</small><b>${s.hp.cur}</b></div><div class="stat"><small>Максимум</small><b>${s.hp.max}</b></div><div class="stat"><small>Тимчасові</small><b>${s.hp.temp}</b></div></div>
    <label class="fld"><span>Кількість</span><input type="number" inputmode="numeric" data-bind="modal.amount" value="${esc(m.amount)}" placeholder="0"></label>
    <div class="grid3 mt"><button class="btn danger" data-act="hpApply" data-k="dmg">− Шкода</button><button class="btn" data-act="hpApply" data-k="heal" style="color:#2fbf4a">+ Лікування</button><button class="btn" data-act="hpApply" data-k="temp">Тимч. ХП</button></div>
    <h3 class="mt2">Рятівні кидки від смерті</h3>
    <div class="ln"><span class="grow">✅ Успіхи: ${s.deathSaves.s}/3</span><div class="stepper"><button data-act="dsStep" data-k="s" data-d="-1">−</button><button data-act="dsStep" data-k="s" data-d="1">+</button></div></div>
    <div class="ln"><span class="grow">❌ Провали: ${s.deathSaves.f}/3</span><div class="stepper"><button data-act="dsStep" data-k="f" data-d="-1">−</button><button data-act="dsStep" data-k="f" data-d="1">+</button></div></div>
    <div class="ln"><span class="grow">🎲 Кості хітів: ${s.level - s.hitDiceUsed}/${s.level}</span>${M ? '<div class="stepper"><button data-act="hdStep" data-d="1" title="Витратити">−</button><button data-act="hdStep" data-d="-1" title="Відновити">+</button></div>' : '<small class="hint">витрачаються на короткому відпочинку</small>'}</div>
    <div class="ln"><span class="grow">⭐ Натхнення: ${R.inspCount(s)}</span>${M ? '<div class="stepper"><button data-act="insp" data-d="-1">−</button><button data-act="insp" data-d="1">+</button></div>' : '<small class="hint">дає майстер</small>'}</div>
    ${M ? `<div class="btns"><button class="btn" data-act="rest" data-kind="short">☕ Короткий відпочинок</button><button class="btn" data-act="rest" data-kind="long">🌙 Довгий відпочинок</button></div>`
      : '<p class="hint mt">Зміни хітів бачить майстер у журналі. Відпочинок оголошує майстер.</p>'}`;
  },

  eventStart: (m) => `${hdr('⚔️ Початок події', 'Усе, що зроблять учасники, запишеться окремо. Після завершення звіт прийде файлом у чат з ботом.')}
    <label class="fld"><span>Назва</span><input data-bind="modal.name" maxlength="80" placeholder="Напр. Бій з гоблінами" value="${esc(m.name)}"></label>
    <div class="fld"><span>Тип</span></div>
    <div class="chips wrap">${Object.entries(R.EVENT_TYPES).map(([k, [n, i]]) => `<button class="chip ${m.evType === k ? 'on' : ''}" data-act="eventType" data-k="${k}">${i} ${n}</button>`).join('')}</div>
    <div class="fld mt"><span>Учасники</span></div>
    <p class="hint">Персонаж, який уже в іншій події, перейде в цю.</p>
    ${evCharPicks(S.room, 0, m.chars)}
    <button class="btn primary block mt2" data-act="eventStart">Почати подію</button>`,

  eventMembers: (m) => `${hdr('👥 Учасники', `${esc(m.name)} — хто бере участь у події`)}
    <p class="hint">Персонаж з іншої події перейде в цю. Якщо інша подія залишиться без учасників — вона перетече в цю, звіт буде спільний. Прибереш усіх — подія завершиться, а звіт прийде в чат.</p>
    ${evCharPicks(S.room, m.eventId, m.chars)}
    <button class="btn primary block mt2" data-act="eventMembersSave">Зберегти</button>`,

  eventMerge: (m) => {
    const others = (S.room.room.events || []).filter((e) => e.id !== m.eventId);
    return `${hdr('🔗 Об’єднати події', `Учасники й усі записи «${esc(m.name)}» перейдуть у вибрану подію. Звіт буде один — спільний.`)}
    ${others.map((e) => `<div class="pick" data-act="eventMergePick" data-id="${e.id}"><input type="radio" ${m.intoId === e.id ? 'checked' : ''} tabindex="-1" style="pointer-events:none">
      <span>${evType(e.type)[1]} ${esc(e.name)}</span><span class="v hint">👥 ${e.members.length}</span></div>`).join('')}
    <button class="btn primary block mt2" data-act="eventMergeSave">Об’єднати</button>`;
  },

  eventAdj: (m) => `${hdr('± Шкода', `${esc(m.name)} — поправка до завданої шкоди за подію`)}
    <label class="fld"><span>Скільки (можна від’ємне)</span><input type="number" inputmode="numeric" data-bind="modal.amount" value="${esc(m.amount)}"></label>
    <div class="chips">${[1, 5, 10, -1, -5, -10].map((n) => `<button class="chip" data-act="eventAdjQuick" data-n="${n}">${n > 0 ? '+' : '−'}${Math.abs(n)}</button>`).join('')}</div>
    <label class="fld"><span>Примітка (необов’язково)</span><input data-bind="modal.note" maxlength="80" placeholder="Напр. закляття «Вогняна куля»" value="${esc(m.note)}"></label>
    <button class="btn primary block mt2" data-act="eventAdjSave">Зберегти</button>`,

  xp: (m) => {
    const ch = currentChar();
    if (!ch) return null;
    const s = ch.sheet;
    const next = s.level < 20 ? R.XP_TABLE[s.level] : null;
    return `${hdr('⭐ Досвід', `${esc(s.name)}: ${s.xp}${next ? ` / ${next} до ${s.level + 1} рів.` : ''}`)}
    <label class="fld"><span>Нарахувати (можна від’ємне)</span><input type="number" inputmode="numeric" data-bind="modal.amount" value="${esc(m.amount)}"></label>
    <div class="chips">${[25, 50, 100, 200, 300, 500, 1000].map((n) => `<button class="chip" data-act="xpQuick" data-n="${n}">+${n}</button>`).join('')}</div>
    <p class="hint">Коли досвід досягне порогу 5e, гравцю відкриється підвищення рівня.</p>
    <button class="btn primary block mt" data-act="xpSave">Нарахувати</button>`;
  },

  money: (m) => {
    const ch = currentChar();
    if (!ch) return null;
    const title = { spend: '💸 Витратити гроші', give: '🤝 Передати гроші', set: '💰 Гроші персонажа' }[m.mode];
    return `${hdr(title, `Зараз: ${moneyStr(ch.sheet.money)}`)}
    ${m.mode === 'give' ? `<label class="fld"><span>Кому</span><select data-bind="modal.to"><option value="">Обери персонажа</option>${S.room.mates.map((x) => `<option value="${x.charId}" ${String(m.to) === String(x.charId) ? 'selected' : ''}>${esc(x.name)} (${esc(x.playerName || '')})</option>`).join('')}</select></label>` : ''}
    <div class="grid3 mt">${R.COINS.map((k) => `<label class="fld"><span>${R.COIN_NAMES[k]} (${R.COIN_FULL[k]})</span><input type="number" inputmode="numeric" min="0" data-bind="modal.vals.${k}" value="${esc(m.vals[k] ?? '')}"></label>`).join('')}</div>
    <button class="btn primary block mt2" data-act="moneySave">${m.mode === 'set' ? 'Зберегти' : m.mode === 'give' ? 'Передати' : 'Витратити'}</button>`;
  },

  item: (m) => {
    const ch = currentChar();
    const it = ch && (ch.items || []).find((x) => x.id === m.id);
    if (!it) return null;
    const d = it.data;
    const M = isMaster();
    const icat = R.itemCat(d);
    const rows = [['Рідкість', `<span class="rname">${R.RARITIES[d.rarity].name}</span>`], ['Тип', R.ITEM_TYPES[d.type]], ['Категорія', icat ? R.ITEM_CATS[icat] : ''], ['Ціна', abbrify(d.cost)], ['Вага', d.weight != null ? `${d.weight} ${ab('фнт')}` : ''],
      ['Шкода', abbrify([d.damage, d.dmgType].filter(Boolean).join(' '))], [`${ab('Дод.')} шкода`, abbrify(d.damage2)], ['Властивості', esc(d.props)], ['Магічний бонус', d.bonus ? `+${d.bonus}` : ''],
      [ab('КЗ'), d.ac != null && d.ac !== '' ? (d.type === 'shield' ? `+${d.ac}` : abbrify(`${d.ac}${d.dexMax == null ? ' + СПР' : d.dexMax ? ` + СПР (макс. ${d.dexMax})` : ''}`)) : ''],
      [`Бонус до ${ab('КЗ')}`, d.acBonus ? `+${d.acBonus}` : ''], ['Потрібна Сила', d.strReq || ''], ['Непомітність', d.stealthDis ? 'перешкода' : ''], ['Налаштування', esc(d.attune)], ['Заряди', esc(d.charges)]]
      .filter(([, v]) => v !== '' && v != null);
    const wd = withBase(d);
    if (wd.type === 'weapon' || (['staff', 'rod'].includes(wd.type) && wd.damage)) {
      const w = R.weaponAttack(ch.sheet, wd);
      rows.push(['Атака', `${fm(w.hit)} · ${wd.damage ? abbrify(w.dmg) : 'шкода не вказана'}`]);
      if (w.noProf) rows.push(['Володіння', '<span class="warn">немає — без бонусу майстерності до атаки</span>']);
    }
    if (R.armorProficient(ch.sheet, d) === false) rows.push(['Володіння', '<span class="warn">немає — перешкода на СИЛ/СПР, без заклять</span>']);
    const cons = R.isConsumable(d);
    rows.push(['Витратний', cons ? 'так' : 'ні']);
    const equipable = ['weapon', 'armor', 'shield', 'ring', 'wondrous', 'staff', 'rod', 'wand'].includes(d.type);
    let h = `<div class="rc-${esc(d.rarity)}">${hdr(`<span class="rname">${ITEM_ICON[d.type] || ''} ${esc(d.name)}</span>`, `Кількість: ${it.qty}${it.equipped ? ' · екіпіровано' : ''}${it.attuned ? ' · налаштовано' : ''}`)}
      <dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      ${d.desc ? `<div class="textblock mt">${abbrify(d.desc)}</div>` : ''}</div>`;
    if (isRO()) return h;
    if (!M) {
      if (cons) {
        h += `<div class="card"><h3>Використати</h3><div class="row mt"><div class="stepper grow"><button data-act="qtyStep" data-d="-1">−</button>
          <input type="number" data-bind="modal.qty" value="${m.qty}" min="1" max="${it.qty}"><button data-act="qtyStep" data-d="1" data-max="${it.qty}">+</button></div>
          <button class="btn primary" data-act="useItem">Використати</button></div><small class="hint">Кількість зменшиться, майстер отримає сповіщення.</small></div>`;
      } else {
        h += '<p class="hint mt">Це не витратний предмет: його кількість змінює лише майстер.</p>';
      }
      const attProblem = d.attune && !it.attuned ? R.attuneProblem(ch.sheet, d.attune) : null;
      h += `<div class="btns">${equipable ? `<button class="btn" data-act="equip">${it.equipped ? 'Зняти' : 'Екіпірувати'}</button>` : ''}
        ${d.attune ? `<button class="btn ${attProblem ? 'disabled' : ''}" data-act="attune">${it.attuned ? 'Скасувати налаштування' : 'Налаштуватися'}</button>` : ''}
        ${S.room.mates.length ? '<button class="btn" data-act="giveItemModal">🤝 Передати</button>' : ''}
        ${cons ? '<button class="btn danger" data-act="dropItem">🗑 Викинути</button>' : ''}</div>
        ${attProblem ? `<p class="hint">${esc(attProblem)}</p>` : ''}`;
    } else {
      h += `<div class="card"><h3>Кількість</h3><div class="row mt"><div class="stepper grow"><button data-act="qtyStep" data-d="-1" data-min="0">−</button>
        <input type="number" data-bind="modal.qty" value="${m.qty}" min="0"><button data-act="qtyStep" data-d="1">+</button></div>
        <button class="btn primary" data-act="masterQty">Зберегти</button></div></div>
        <div class="btns"><button class="btn" data-act="editItemForm">✏️ Редагувати</button>${equipable ? `<button class="btn" data-act="equip">${it.equipped ? 'Зняти' : 'Екіпірувати'}</button>` : ''}
        ${d.attune ? `<button class="btn" data-act="attune">${it.attuned ? 'Скасувати налашт.' : 'Налаштувати'}</button>` : ''}
        <button class="btn danger" data-act="removeItem">Забрати</button></div>`;
    }
    return h;
  },

  give: (m) => {
    const ch = currentChar();
    const it = ch && (ch.items || []).find((x) => x.id === m.itemId);
    if (!it) return null;
    return `${hdr('🤝 Передати предмет', esc(it.data.name))}
    <label class="fld"><span>Кому</span><select data-bind="modal.to"><option value="">Обери персонажа</option>${S.room.mates.map((x) => `<option value="${x.charId}" ${String(m.to) === String(x.charId) ? 'selected' : ''}>${esc(x.name)} (${esc(x.playerName || '')})</option>`).join('')}</select></label>
    <label class="fld"><span>Кількість (макс. ${it.qty})</span><input type="number" data-bind="modal.qty" value="${m.qty}" min="1" max="${it.qty}"></label>
    <button class="btn primary block mt2" data-act="giveItem">Передати</button>`;
  },

  itemForm: (m) => {
    const f = m.form;
    const ch = currentChar();
    const showWeapon = ['weapon', 'ammo', 'staff', 'rod', 'other'].includes(f.type);
    const showArmor = ['armor', 'shield'].includes(f.type);
    const mine = m.mode === 'myNew' || m.mode === 'myEdit';
    const title = { edit: '✏️ Редагувати предмет', custom: '＋ Свій предмет', issue: '🎁 Видати предмет', myNew: '📦 Новий предмет у каталог', myEdit: '📦 Мій предмет' }[m.mode];
    return `${hdr(title, mine ? 'Твій каталог — спільний для всіх кімнат' : ch ? `Персонаж: ${esc(ch.sheet.name)}` : '')}
    <div class="card rc-${esc(f.rarity)} center"><span class="rname" style="font-size:18px">${ITEM_ICON[f.type] || ''} ${esc(f.name || 'Без назви')}</span><br><small>${R.RARITIES[f.rarity].name}</small></div>
    ${f.desc && m.mode === 'issue' ? `<div class="textblock mt">${esc(f.desc)}</div>` : ''}
    ${m.mode === 'issue' || m.mode === 'custom' ? `<div class="card"><label class="fld" style="margin:0"><span>Кількість</span><div class="stepper"><button data-act="qtyStep" data-d="-1">−</button>
      <input type="number" data-bind="modal.qty" value="${m.qty}" min="1"><button data-act="qtyStep" data-d="1">+</button></div></label>
      ${m.mode === 'custom' ? `<label class="row fld"><input type="checkbox" data-bind="modal.saveMine" ${m.saveMine ? 'checked' : ''}><span>Також зберегти в мій каталог</span></label>` : ''}
      <button class="btn primary block mt" data-act="saveItemForm">Видати ${ch ? esc(ch.sheet.name) : ''}</button></div>` : ''}
    <details ${m.mode !== 'issue' ? 'open' : ''}><summary>Властивості предмета${m.mode === 'issue' ? ' (можна змінити перед видачею)' : ''}</summary>
    <label class="fld"><span>Назва</span><input data-bind="modal.form.name" value="${esc(f.name)}" maxlength="80"></label>
    <div class="grid2"><label class="fld"><span>Рідкість</span><select data-bind="modal.form.rarity" data-rerender="modal">${R.RARITY_IDS.map((k) => `<option value="${k}" ${f.rarity === k ? 'selected' : ''}>${R.RARITIES[k].name}</option>`).join('')}</select></label>
    <label class="fld"><span>Тип</span><select data-bind="modal.form.type" data-rerender="modal">${Object.entries(R.ITEM_TYPES).map(([k, v]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
    <div class="grid3"><label class="fld"><span>Ціна</span><input data-bind="modal.form.cost" value="${esc(f.cost || '')}" placeholder="10 ЗМ"></label>
    <label class="fld"><span>Вага, фнт</span><input type="number" step="0.25" data-bind="modal.form.weight" value="${esc(f.weight ?? '')}"></label>
    <label class="fld"><span>Магічний +</span><input type="number" data-bind="modal.form.bonus" value="${esc(f.bonus || '')}" placeholder="0"></label></div>
    <label class="row fld"><input type="checkbox" data-bind="modal.form.consumable" ${R.isConsumable(f) ? 'checked' : ''}><span>Витратний предмет (гравець може використовувати й зменшувати кількість)</span></label>
    ${f.type === 'weapon' ? `<label class="fld"><span>Базова зброя (заповнить шкоду, властивості й категорію)</span><select data-onchange="applyBaseWeapon"><option value="">—</option>
      ${BASE_WEAPONS.map((w) => `<option value="${w.id}" ${(f.kind ? f.kind === w.id : f.baseName === w.name) ? 'selected' : ''}>${esc(w.name)} — ${esc(w.damage || '—')} ${esc(w.dmgType || '')}</option>`).join('')}</select></label>
      <label class="fld"><span>Категорія зброї</span><select data-bind="modal.form.cat"><option value="">—</option>${R.WEAPON_CAT_IDS.map((k) => `<option value="${k}" ${f.cat === k ? 'selected' : ''}>${R.ITEM_CATS[k]}</option>`).join('')}</select></label>` : ''}
    ${f.type === 'armor' ? `<label class="fld"><span>Тип обладунку</span><select data-onchange="armorCat"><option value="">—</option>${R.ARMOR_CAT_IDS.map((k) => `<option value="${k}" ${f.cat === k ? 'selected' : ''}>${R.ITEM_CATS[k]}</option>`).join('')}</select></label>` : ''}
    ${showWeapon ? `<div class="grid2"><label class="fld"><span>Шкода</span><input data-bind="modal.form.damage" value="${esc(f.damage || '')}" placeholder="1к8"></label>
      <label class="fld"><span>Тип шкоди</span><select data-bind="modal.form.dmgType"><option value="">—</option>${R.DAMAGE_TYPES.map((t) => `<option value="${esc(t)}" ${f.dmgType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <label class="fld"><span>Додаткова шкода</span><input data-bind="modal.form.damage2" value="${esc(f.damage2 || '')}" placeholder="+2к6 вогнем"></label>
      <label class="fld"><span>Властивості</span><input data-bind="modal.form.props" value="${esc(f.props || '')}" placeholder="Фехтувальна, легка"></label>
      <label class="row fld"><input type="checkbox" data-bind="modal.form.ranged" ${f.ranged ? 'checked' : ''}><span>Зброя дальнього бою</span></label>` : ''}
    ${showArmor ? `<div class="grid3"><label class="fld"><span>${f.type === 'shield' ? 'Бонус щита' : 'Базовий КЗ'}</span><input type="number" data-bind="modal.form.ac" value="${esc(f.ac ?? '')}"></label>
      ${f.type === 'armor' ? `<label class="fld"><span>Макс. СПР</span><input type="number" data-bind="modal.form.dexMax" value="${esc(f.dexMax ?? '')}" placeholder="без меж"></label>
      <label class="fld"><span>Потрібна Сила</span><input type="number" data-bind="modal.form.strReq" value="${esc(f.strReq ?? '')}"></label>` : ''}</div>
      ${f.type === 'armor' ? `<label class="row fld"><input type="checkbox" data-bind="modal.form.stealthDis" ${f.stealthDis ? 'checked' : ''}><span>Перешкода на Непомітність</span></label>` : ''}` : ''}
    <div class="grid2"><label class="fld"><span>Бонус до КЗ (каблучки, плащі)</span><input type="number" data-bind="modal.form.acBonus" value="${esc(f.acBonus || '')}" placeholder="0"></label>
    <label class="fld"><span>Заряди</span><input data-bind="modal.form.charges" value="${esc(f.charges || '')}" placeholder="7"></label></div>
    <label class="fld"><span>Налаштування (порожньо — не потрібне)</span><input data-bind="modal.form.attune" value="${esc(f.attune || '')}" placeholder="так / так (заклинач)"></label>
    <label class="fld"><span>Опис</span><textarea data-bind="modal.form.desc" maxlength="4000">${esc(f.desc || '')}</textarea></label>
    </details>
    ${m.mode === 'edit' ? '<button class="btn primary block mt2" data-act="saveItemForm">💾 Зберегти</button>' : ''}
    ${mine ? `<button class="btn primary block mt2" data-act="saveItemForm">💾 Зберегти в каталог</button>
      ${m.mode === 'myEdit' ? '<button class="btn danger block mt" data-act="deleteMyItem">🗑 Видалити з каталогу</button>' : ''}` : ''}`;
  },

  spell: (m) => {
    const ch = currentChar();
    const e = m.id && ch ? (ch.sheet.spell.spells || []).find((x) => x.id === m.id) : null;
    const sid = (e && e.sid) || m.sid;
    const db = sid ? R.SPELLS[sid] : null;
    const sp = db || e;
    if (!sp) return null;
    const rows = [['Коло', sp.level ? `${sp.level}` : 'замовляння'], ['Школа', sp.school], ['Час створення', sp.time], ['Дистанція', sp.range], ['Компоненти', sp.comp],
      ['Тривалість', db ? R.spellDuration(db) : sp.dur], ['Концентрація', !db && sp.conc ? 'так' : ''], ['Ритуал', sp.ritual ? 'так' : ''],
      ['Класи', db ? db.classes.map((c) => R.CLASSES[c].name).join(', ') : ''],
      ['Підготовлено', e && sp.level && R.spellPlan(ch.sheet).prep ? (e.prepared ? 'так' : 'ні') : ''], ['Джерело', e && e.by === 'm' ? 'видав майстер' : '']].filter(([, v]) => v);
    let h = `${hdr(`📖 ${esc(sp.name)}`)}<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${k === 'Компоненти' ? compAbbr(v) : abbrify(v)}</dd>`).join('')}</dl>
    ${sp.desc ? `<div class="textblock mt">${abbrify(sp.desc)}</div>` : ''}`;
    if (e && isMaster() && !isRO()) {
      h += `<div class="btns">${e.sid ? '' : `<button class="btn" data-act="spellForm" data-id="${esc(e.id)}">✏️ Змінити</button>`}<button class="btn danger" data-act="deleteSpell" data-id="${esc(e.id)}">🗑 Прибрати</button></div>`;
    }
    return h;
  },
  spellInfo: (m) => MODALS.spell({ sid: m.sid }),

  spellForm: (m) => {
    const f = m.form;
    return `${hdr(m.id ? '✏️ Закляття' : '＋ Нове закляття або вміння')}
    <label class="fld"><span>Назва</span><input data-bind="modal.form.name" value="${esc(f.name)}" maxlength="80" placeholder="Напр. Магічна стріла"></label>
    <div class="grid2"><label class="fld"><span>Коло</span><select data-bind="modal.form.level" data-num>${Array.from({ length: 10 }, (_, i) => `<option value="${i}" ${num(f.level) === i ? 'selected' : ''}>${i ? `${i} коло` : 'Замовляння'}</option>`).join('')}</select></label>
    <label class="fld"><span>Школа</span><select data-bind="modal.form.school"><option value="">—</option>${R.SPELL_SCHOOLS.map((x) => `<option value="${esc(x)}" ${f.school === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <div class="grid2"><label class="fld"><span>Час створення</span><input data-bind="modal.form.time" value="${esc(f.time)}" placeholder="1 дія"></label>
    <label class="fld"><span>Дистанція</span><input data-bind="modal.form.range" value="${esc(f.range)}" placeholder="120 фт"></label></div>
    <div class="grid2"><label class="fld"><span>Компоненти</span><input data-bind="modal.form.comp" value="${esc(f.comp)}" placeholder="В, С, М"></label>
    <label class="fld"><span>Тривалість</span><input data-bind="modal.form.dur" value="${esc(f.dur)}" placeholder="Миттєва"></label></div>
    <div class="grid3"><label class="row fld"><input type="checkbox" data-bind="modal.form.conc" ${f.conc ? 'checked' : ''}><span>Концентрація</span></label>
    <label class="row fld"><input type="checkbox" data-bind="modal.form.ritual" ${f.ritual ? 'checked' : ''}><span>Ритуал</span></label>
    <label class="row fld"><input type="checkbox" data-bind="modal.form.prepared" ${f.prepared ? 'checked' : ''}><span>Підготовлено</span></label></div>
    <label class="fld"><span>Опис</span><textarea data-bind="modal.form.desc" maxlength="3000">${esc(f.desc)}</textarea></label>
    <button class="btn primary block mt2" data-act="saveSpell">💾 Зберегти</button>`;
  },

  text: (m) => {
    const short = ['age', 'height', 'weight', 'eyes', 'skin', 'hair'];
    return `${hdr('✏️ Редагування')}
    ${m.fields.map((k) => (short.includes(k)
      ? `<label class="fld"><span>${R.TEXT_FIELDS[k]}</span><input data-bind="modal.vals.${k}" value="${esc(m.vals[k] || '')}" maxlength="40"></label>`
      : `<label class="fld"><span>${R.TEXT_FIELDS[k]}</span><textarea data-bind="modal.vals.${k}" maxlength="4000">${esc(m.vals[k] || '')}</textarea></label>`)).join('')}
    <button class="btn primary block mt2" data-act="saveText">💾 Зберегти</button>`;
  },

  charMore: () => {
    const ch = currentChar();
    if (!ch) return null;
    return `${hdr(esc(ch.sheet.name), `Гравець: ${esc(charOwnerName(ch))}`)}
    <button class="btn block mt" data-act="rest" data-kind="short">☕ Короткий відпочинок (ресурси ☕, кості хітів)</button>
    <button class="btn block mt" data-act="rest" data-kind="long">🌙 Довгий відпочинок (повні ХП, комірки, ресурси, ½ костей хітів)</button>
    <button class="btn danger block mt" data-act="markDead">☠ Персонаж загинув</button>
    <button class="btn danger block mt" data-act="kick" data-uid="${ch.userId}" data-name="${esc(charOwnerName(ch))}">🚪 Видалити гравця з кімнати</button>`;
  },

  levelUp: (m) => {
    const ch = currentChar();
    if (!ch) return null;
    const s = ch.sheet;
    const nl = s.level + 1;
    const cls = R.CLASSES[s.classId] || { hd: 8, name: '' };
    const cd = R.CLASS_DATA[s.classId];
    const needSub = R.subclassNeeded(s, nl);
    // попередній перегляд: лист із вмінням нового рівня й обраним підкласом
    const tmp = clone(s);
    const before = Array.isArray(s.features) ? s.features.length : 0;
    R.gainLevelFeatures(tmp, nl, { subclassId: m.subclassId });
    const subOk = !R.subclassNeeded(tmp, nl);
    const newFeats = (tmp.features || []).slice(before).filter((x) => x.lvl === nl && x.src !== 'choice');
    const backfill = !Array.isArray(s.features) ? (tmp.features || []).filter((x) => x.lvl < nl).length : 0;
    const specs = subOk ? R.pendingChoices(tmp, nl) : [];
    const optSheet = clone(tmp);
    if ((m.choices.pactBoon || []).length) optSheet.choices = { ...optSheet.choices, pactBoon: [...(optSheet.choices.pactBoon || []), ...m.choices.pactBoon] };
    const asiLvl = R.isAsiLevel(s.classId, nl);
    const expN = R.expertiseAt(s.classId, nl);
    const asiSum = Object.values(m.asi).reduce((t, v) => t + v, 0);
    const feat = asiLvl && m.asiMode === 'feat' ? R.FEATS.find((x) => x.id === m.feat.id) : null;
    const conGain = (m.asiMode === 'asi' ? (m.asi.con || 0) : feat && feat.asi && (feat.asi.length === 1 ? feat.asi[0] : m.feat.ability) === 'con' ? 1 : 0);
    const conMod = R.mod(s.abilities.con + conGain);
    const hpBonus = R.hpPerLevelBonus(tmp) + (feat && feat.id === 'tough' ? 2 : 0);
    const avg = Math.max(1, R.hdAverage(cls.hd) + conMod + hpBonus);
    const oldSlots = R.spellSlots(s.classId, s.level, s.subclassId);
    const newSlots = R.spellSlots(s.classId, nl, tmp.subclassId);
    const pOld = R.profBonus(s.level);
    const pNew = R.profBonus(nl);
    let h = `${hdr(`⬆️ ${nl} рівень`, `${esc(s.name)} · ${esc(cls.name)}${tmp.subclass ? ` · ${esc(tmp.subclass)}` : ''}`)}
    <div class="card"><h3>Хіти</h3><p class="hint">${abbrify(`Кість хітів к${cls.hd}${conMod ? `, Статура ${fm(conMod)}` : ''}${hpBonus ? `, бонус +${hpBonus}` : ''}`)}</p>
      <div class="grid2"><button class="btn ${m.hpMethod === 'avg' ? 'primary' : ''}" data-act="lvHp" data-m="avg">Середнє: +${avg}</button>
      <button class="btn ${m.hpMethod === 'roll' ? 'primary' : ''}" data-act="lvHp" data-m="roll">🎲 Кинути к${cls.hd}${conMod + hpBonus ? fm(conMod + hpBonus) : ''}</button></div>
      <small class="hint">Кидок робить сервер під час підтвердження.</small></div>`;
    if (needSub && cd) h += subclassPickerHtml(s.classId, m.subclassId, 'modal.subclassId');
    if (newFeats.length) h += `<div class="lines"><h3>Нові вміння</h3>${featureListHtml(newFeats)}</div>`;
    if (backfill) h += `<p class="hint">Також буде додано ${backfill} вмінь попередніх рівнів, яких ще немає в листі.</p>`;
    if (specs.length) h += choicesHtml(specs, optSheet, nl, 'modal.choices', m.choices);
    if (asiLvl) {
      h += `<div class="card"><h3>Підвищення характеристик або риса</h3><div class="chips">
        <button class="chip ${m.asiMode === 'asi' ? 'on' : ''}" data-act="lvMode" data-m="asi">+2 до характеристик</button>
        <button class="chip ${m.asiMode === 'feat' ? 'on' : ''}" data-act="lvMode" data-m="feat">Риса</button></div>`;
      if (m.asiMode === 'asi') {
        h += `<p class="hint">Розподіли 2 очки: +2 до однієї або +1 до двох. Максимум 20. Використано: ${asiSum}/2</p>
        ${R.ABILITIES.map((a) => { const v = m.asi[a] || 0; return `<div class="ln"><span class="grow">${R.ABILITY_NAMES[a]} <span class="hint">${s.abilities[a]}${v ? ` → ${s.abilities[a] + v}` : ''}</span></span>
          <div class="stepper"><button data-act="lvAsi" data-a="${a}" data-d="-1">−</button><input value="${v ? '+' + v : '0'}" readonly style="width:50px"><button data-act="lvAsi" data-a="${a}" data-d="1">+</button></div></div>`; }).join('')}`;
      } else {
        const fo = R.featOptions(tmp);
        h += `<label class="fld"><span>Риса</span><select data-bind="modal.feat.id" data-rerender="modal"><option value="">Обери рису…</option>
          ${fo.map((x) => `<option value="${x.id}" ${m.feat.id === x.id ? 'selected' : ''} ${x.disabled ? 'disabled' : ''}>${esc(x.name)}${x.reason ? ` (${esc(x.reason)})` : ''}</option>`).join('')}</select></label>`;
        if (feat) {
          h += `<p class="textblock">${esc(feat.desc)}</p>`;
          if (feat.asi && feat.asi.length > 1) {
            h += `<p class="hint">Яку характеристику підвищити на +1?</p><div class="chips">${feat.asi.map((a) => `<button class="chip ${m.feat.ability === a ? 'on' : ''} ${s.abilities[a] >= 20 ? 'muted' : ''}" data-act="featAbility" data-a="${a}">${R.ABILITY_NAMES[a]} (${s.abilities[a]})</button>`).join('')}</div>`;
          }
          if (feat.effect === 'skilled') {
            const sel = m.feat.skills || [];
            h += `<p class="hint">Обери 3 навички (${sel.length}/3)</p>${R.SKILL_IDS.map((k) => {
              const on = sel.includes(k); const dis = !!tmp.skills[k] || (!on && sel.length >= 3);
              return `<div class="pick ${dis && !on ? 'disabled' : ''}" data-act="pickChoice" data-path="modal.feat" data-spec="skills" data-k="${k}" data-max="3"><input type="checkbox" ${on ? 'checked' : ''} style="pointer-events:none"><span>${R.SKILLS[k][0]}</span>${tmp.skills[k] ? '<span class="v hint">вже є</span>' : ''}</div>`;
            }).join('')}`;
          }
        }
      }
      h += '</div>';
    }
    if (expN) {
      const prof = R.SKILL_IDS.filter((k) => tmp.skills[k] === 1);
      h += `<div class="card"><h3>Експертиза</h3><p class="hint">Обери ${expN} навички (${m.expertise.length}/${expN})</p>${prof.map((k) => {
        const on = m.expertise.includes(k);
        return `<div class="pick ${!on && m.expertise.length >= expN ? 'disabled' : ''}" data-act="lvExp" data-k="${k}"><input type="checkbox" ${on ? 'checked' : ''} style="pointer-events:none"><span>${R.SKILLS[k][0]}</span></div>`;
      }).join('')}</div>`;
    }
    const slotChange = JSON.stringify(oldSlots) !== JSON.stringify(newSlots);
    h += `<div class="card"><h3>Що ще зміниться</h3>
      ${pNew !== pOld ? `<div class="ln"><span>Бонус майстерності</span><span class="v">${fm(pOld)} → ${fm(pNew)}</span></div>` : ''}
      ${slotChange ? `<div class="ln"><span>Комірки заклять</span><span class="v">${oldSlots.join('/') || '—'} → ${newSlots.join('/')}</span></div>` : ''}
      <div class="ln"><span>Кості хітів</span><span class="v">${nl}×к${cls.hd}</span></div></div>
    <button class="btn primary block mt" data-act="lvSubmit">✅ Підвищити рівень</button>`;
    return h;
  },

  catView: (m) => {
    const it = CATALOG.find((x) => x.catalogId === m.id);
    if (!it) return null;
    const rows = [['Рідкість', R.RARITIES[it.rarity].name], ['Тип', R.ITEM_TYPES[it.type]], ['Ціна', it.cost], ['Вага', it.weight != null ? `${it.weight} фнт` : ''],
      ['Шкода', [it.damage, it.dmgType].filter(Boolean).join(' ')], ['Дод. шкода', it.damage2], ['Властивості', it.props], ['КЗ', it.ac], ['Магічний бонус', it.bonus ? `+${it.bonus}` : ''],
      ['Налаштування', it.attune], ['Витратний', R.isConsumable(it) ? 'так' : '']].filter(([, v]) => v !== '' && v != null && v !== undefined);
    return `<div class="rc-${esc(it.rarity)}">${hdr(`<span class="rname">${ITEM_ICON[it.type] || ''} ${esc(it.name)}</span>`, 'Предмет D&D 5e (SRD)')}</div>
    <dl class="kv">${rows.map(([k, v]) => `<dt>${abbrify(k)}</dt><dd>${abbrify(v)}</dd>`).join('')}</dl>
    ${it.desc ? `<div class="textblock mt">${abbrify(it.desc)}</div>` : ''}
    <button class="btn primary block mt2" data-act="copyToMine" data-id="${esc(it.catalogId)}">📋 Зберегти копію в мій каталог</button>
    <p class="hint">Копію можна змінити: назву, шкоду, опис, рідкість тощо.</p>`;
  },

  featInfo: (m) => {
    const ch = currentChar();
    const f = ch && (ch.sheet.features || [])[m.i];
    if (!f) return null;
    const s = ch.sheet;
    const src = { race: `Раса: ${raceName(s)}`, class: `Клас: ${className(s)}`, subclass: `Підклас: ${s.subclass || '—'}`, choice: 'Вибір за класом', feat: 'Риса', custom: 'Додано майстром' }[f.src || 'custom'];
    const det = featureDetails(s, f);
    return `${hdr(esc(f.name), `${esc(src)}${f.src !== 'race' ? ` · отримано на ${f.lvl} рівні` : ''}`)}${infoBody(f.desc, det)}`;
  },
  resInfo: (m) => {
    const ch = currentChar();
    const r = ch && R.sheetResources(ch.sheet).find((x) => x.id === m.id);
    if (!r) return null;
    const det = resourceDetails(ch.sheet, r);
    return `${hdr(esc(det.title), 'Ресурс класу')}${infoBody(det.desc, det)}`;
  },

  featureForm: (m) => `${hdr('＋ Нове вміння')}
    <label class="fld"><span>Назва</span><input data-bind="modal.name" value="${esc(m.name)}" maxlength="100"></label>
    <label class="fld"><span>Рівень</span><input type="number" data-bind="modal.lvl" value="${esc(m.lvl)}" min="1" max="20"></label>
    <label class="fld"><span>Опис</span><textarea data-bind="modal.desc" maxlength="800">${esc(m.desc)}</textarea></label>
    <button class="btn primary block mt2" data-act="saveFeature">💾 Додати</button>`,

  pool: (m) => {
    const ch = currentChar();
    const r = ch && R.sheetResources(ch.sheet).find((x) => x.id === m.id);
    if (!r) return null;
    const M = isMaster();
    return `${hdr(esc(r.name), `Доступно ${r.max - r.used} з ${r.max}`)}
    <label class="fld"><span>${M ? 'Використано (встановити)' : 'Скільки витратити'}</span><input type="number" data-bind="modal.amount" value="${esc(m.amount)}" min="0" max="${M ? r.max : r.max - r.used}"></label>
    <button class="btn primary block mt2" data-act="poolSave">${M ? 'Зберегти' : 'Витратити'}</button>`;
  },
};

function infoBody(desc, det) {
  return `${desc ? `<p class="textblock" style="padding-top:10px">${abbrify(desc)}</p>` : ''}
    ${det.stats.length ? `<div class="card"><h3>Для персонажа зараз</h3><dl class="kv">${det.stats.map(([k, v]) => `<dt>${abbrify(k)}</dt><dd><b>${abbrify(v)}</b></dd>`).join('')}</dl></div>` : ''}
    ${det.lines.length ? `<div class="card"><h3>Як працює</h3><ul class="rules">${det.lines.map((x) => `<li>${abbrify(x)}</li>`).join('')}</ul></div>` : ''}
    ${!desc && !det.stats.length && !det.lines.length ? '<p class="hint mt">Опису немає.</p>' : ''}`;
}

function inviteLink(code) {
  const bot = (S.me && S.me.botUsername) || CFG.BOT_USERNAME || '';
  return `https://t.me/${bot}?start=${code}`;
}

// ================= Дії =================
const roomId = () => S.room && S.room.room.id;
async function reloadAfter(fn, okMsg) {
  const r = await run(fn, okMsg);
  if (r !== undefined) await loadRoom(true);
  return r;
}
function updateTrackers(ch, patch) {
  return api('trackers', { charId: ch.id, patch });
}
// Лише ті поля, які майстер справді змінив у редакторі (щоб не затерти паралельні зміни гравця)
function sheetPatch(o, e) {
  const p = {};
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const k of Object.keys(e)) {
    if (same(o[k], e[k])) continue;
    if (['abilities', 'hp', 'deathSaves', 'skills', 'spell', 'text'].includes(k) && e[k] && typeof e[k] === 'object' && !Array.isArray(e[k])) {
      p[k] = {};
      for (const kk of new Set([...Object.keys(e[k]), ...Object.keys(o[k] || {})])) {
        if (!same((o[k] || {})[kk], e[k][kk])) p[k][kk] = e[k][kk] === undefined ? 0 : e[k][kk];
      }
    } else p[k] = e[k];
  }
  return p;
}
function itemFormBlank() { return { name: '', rarity: 'common', type: 'gear', cost: '', weight: '', desc: '' }; }

const ACT = {
  retry: () => boot(),
  closeModal: () => closeModal(),

  pickRole: async ({ role }) => {
    tapFx();
    S.me.user.role = role;
    api('setRole', { role }).catch(() => {});
    go(role === 'master' ? 'masterHome' : 'playerHome');
  },
  switchRole: () => reset('role'),
  setLang: async ({ v }) => {
    const lang = normLang(v);
    if (lang === LANG) return;
    tapFx();
    busy(true);
    try { await applyLang(lang); } catch (e) { toast('Немає зв’язку із сервером. Перевір інтернет.', true); return; } finally { busy(false); }
    lsSet(LS_LANG, LANG);
    if (S.me && S.me.user) S.me.user.lang = LANG;
    render();
    api('setLang', { lang: LANG }).catch(() => {});
  },
  toHome: () => { const home = isMaster() ? 'masterHome' : 'playerHome'; S.room = null; S.roomId = null; reset('role', home); loadMe(true); },

  createRoom: async () => {
    const el = document.getElementById('newRoomName');
    const name = el.value.trim();
    if (!name) { toast('Вкажи назву кімнати', true); el.focus(); return; }
    const nr = S.newRoom;
    const r = await run(() => api('createRoom', { name, maxStartLevel: nr.pick ? nr.max : 1 }), 'Кімнату створено');
    if (r) { S.newRoom = { name: '', pick: false, max: 5 }; await loadMe(true); openRoom(r.room.id); }
  },
  joinByCode: async () => {
    const code = document.getElementById('joinCode').value.trim().toUpperCase();
    if (!code) { toast('Введи код кімнати', true); return; }
    const r = await run(() => api('joinRoom', { code }), 'Ти в кімнаті!');
    if (r) { await loadMe(true); openRoom(r.room.id); }
  },
  joinInvite: async ({ code }) => {
    const r = await run(() => api('joinRoom', { code }), 'Ти в кімнаті!');
    if (r) { await loadMe(true); S.nav = [{ view: 'role' }, { view: 'playerHome' }]; openRoom(r.room.id); }
  },
  openRoom: ({ id }) => openRoom(id),
  openArchive: async ({ id }) => {
    const a = (S.me.archive || []).find((x) => String(x.id) === String(id));
    if (a && a.status === 'active') { openRoom(a.roomId); return; }
    S.archive = null;
    S.tab = 'sheet';
    go('archiveChar', { charId: Number(id) });
    try {
      S.archive = await api('archiveChar', { charId: Number(id) });
      if (cur().view === 'archiveChar') render();
    } catch (e) { toast(e.message, true); back(); }
  },
  // підказка до значка події на картці гравця (дотик; на комп'ютері — наведення)
  evTip: ({ id }, el) => {
    const ev = findEv(id);
    if (!ev) return;
    const [tn, ti] = evType(ev.type);
    const names = roomChars(S.room).filter((ch) => ev.members.includes(ch.id)).map((ch) => ch.sheet.name);
    showTip(el, `${ti} ${ev.name}`, `<div>Бере участь у цій події</div><div class="hint">${tn} · триває ${evMins(ev)} хв</div>
      <div style="margin-top:6px"><b>Учасники</b>: <span data-notr>${esc(names.join(', '))}</span></div>`);
  },
  abbr: ({ k }, el) => {
    const dice = diceInfo(k);
    const [title, body] = dice || ABBR[k] || [k, ''];
    showTip(el, `${t(title)}${dice || title === k ? '' : ` (${el.textContent.trim() || abLoc(k)})`}`, abbrify(body));
  },
  skillInfo: ({ k }, el) => {
    const ch = currentChar();
    const [name, a] = R.SKILLS[k];
    let body = abbrify(SKILL_INFO[k] || '');
    if (ch) {
      const s = ch.sheet;
      const p = (s.skills && s.skills[k]) || 0;
      const parts = [`${R.ABILITY_SHORT[a]} ${fm(R.mod(s.abilities[a]))}`];
      if (p) parts.push(`майстерність ${fm(p * R.sheetProf(s))}${p === 2 ? ' (експертиза ×2)' : ''}`);
      body += `<br><br><b>Бонус: ${parts.map(abbrify).join(' + ')} = ${fm(R.skillValue(s, k))}</b>${p ? '' : '<br><small class="hint">Без володіння</small>'}`;
    }
    showTip(el, `${t(name)} (${t(R.ABILITY_NAMES[a])})`, body);
  },
  tipClose: () => hideTip(),
  openExt: ({ url }) => { if (tg && tg.openLink) tg.openLink(url); else window.open(url, '_blank'); },
  openTg: ({ url }) => { if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank'); },
  mail: async ({ addr }) => {
    try { await navigator.clipboard.writeText(addr); toast(`Адресу скопійовано: ${addr}`); } catch (e) { toast(addr); }
    setTimeout(() => { window.location.href = `mailto:${addr}`; }, 150);
  },
  openChar: ({ id }) => { S.tab = 'sheet'; go('char', { charId: Number(id) }); },
  tab: ({ tab }) => { S.tab = tab; tapFx(); render(); },
  // кидки кубиків
  dicePurpose: ({ value }) => {
    const ch = S.room && S.room.character;
    if (!ch) return;
    const st = diceState(ch);
    st.purpose = value;
    const a = diceAuto(ch, value);
    if (a) { st.dice = { ...a.dice }; st.mod = a.mod; } else st.mod = 0;
    // перевага/перешкода — ситуативні: для нової мети скидаються, а ефекти (отруєння, лють…) ставлять їх самі
    st.mode = R.effectRoll(ch.effects, value).mode;
    render();
  },
  dieAdd: ({ s }) => { const st = S.dice; if (!st) return; st.dice[s] = Math.min(20, (st.dice[s] || 0) + 1); tapFx(); render(); },
  dieSub: ({ s }) => {
    const st = S.dice; if (!st) return;
    st.dice[s] = Math.max(0, (st.dice[s] || 0) - 1);
    if (!st.dice[s]) delete st.dice[s];
    if (!st.dice[20]) st.mode = '';
    tapFx(); render();
  },
  diceMod: ({ d }) => { const st = S.dice; if (!st) return; st.mod = Math.max(-50, Math.min(50, st.mod + Number(d))); tapFx(); render(); },
  diceModAuto: () => { const ch = S.room && S.room.character; const a = ch && diceAuto(ch, S.dice.purpose); if (a) { S.dice.mod = a.mod; render(); } },
  diceMode: ({ v }) => { const st = S.dice; if (!st || !st.dice[20]) return; st.mode = v; tapFx(); render(); },
  diceReset: () => { const st = S.dice; if (!st) return; Object.assign(st, { purpose: 'free', dice: { 20: 1 }, mod: 0, mode: '' }); render(); },
  rollDice: async () => {
    const ch = S.room && S.room.character;
    const st = S.dice;
    if (!ch || !st) return;
    if (!DICE.some((sd) => st.dice[sd])) { toast('Обери хоча б один кубик', true); return; }
    const [kind, key] = st.purpose.split(':');
    const r = await run(() => api('rollDice', { charId: ch.id, kind, key, dice: st.dice, mod: st.mod, mode: st.mode }));
    if (!r) return;
    st.last = r.roll;
    ch.rolls = [r.roll, ...(ch.rolls || []).filter((x) => x.id !== r.roll.id)].slice(0, 15);
    if (r.roll.crit) haptic(r.roll.crit === 20 ? 'success' : 'warning');
    render();
  },

  invite: () => openModal({ type: 'invite' }),
  shareInvite: () => {
    const r = S.room.room;
    const link = inviteLink(r.id);
    const text = t(`Приєднуйся до гри «${r.name}» у DnD Companion! Код кімнати: ${r.id}`);
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank');
  },
  copy: async ({ text }) => {
    try { await navigator.clipboard.writeText(text); toast('Скопійовано'); } catch (e) { toast('Не вдалося скопіювати — виділи текст вручну', true); }
  },
  roomSettings: () => {
    const lv = S.room.room.maxStartLevel || 1;
    openModal({ type: 'roomSettings', name: S.room.room.name, pick: lv > 1, max: lv > 1 ? lv : 5 });
  },
  renameRoom: async () => {
    const m = S.modal;
    const r = S.room.room;
    const maxLv = m.pick ? Number(m.max) : 1;
    const ok = await run(async () => {
      if (m.name.trim() !== r.name) await api('renameRoom', { roomId: roomId(), name: m.name });
      if (maxLv !== (r.maxStartLevel || 1)) await api('setRoomOptions', { roomId: roomId(), maxStartLevel: maxLv });
      return true;
    }, 'Збережено');
    if (ok) { closeModal(); await loadRoom(true); }
  },
  deleteRoomForm: () => openModal({ type: 'deleteRoom', text: '' }),
  deleteRoom: async () => {
    const text = String(S.modal.text || '').trim();
    if (!text) { toast('Напиши останнє повідомлення гравцям', true); return; }
    if (!(await confirmBox(`Закрити кімнату «${S.room.room.name}»? Гравці втратять до неї доступ і отримають твоє повідомлення.`))) return;
    const ok = await run(() => api('deleteRoom', { roomId: roomId(), message: text }), 'Кімнату закрито');
    if (ok) { S.room = null; S.roomId = null; await loadMe(true); reset('role', 'masterHome'); }
  },
  roomMenu: () => openModal({ type: 'roomMenu' }),
  leaveRoom: async () => {
    if (!(await confirmBox('Вийти з кімнати? Твій персонаж залишиться — повернешся за кодом.'))) return;
    const ok = await run(() => api('leaveRoom', { roomId: roomId() }), 'Ти вийшов з кімнати');
    if (ok) { S.room = null; S.roomId = null; await loadMe(true); reset('role', 'playerHome'); }
  },
  kick: async ({ uid, name }) => {
    if (!(await confirmBox(`Видалити гравця ${name} з кімнати?`))) return;
    const ok = await run(() => api('kick', { roomId: roomId(), userId: Number(uid) }), 'Гравця видалено');
    if (ok) { closeModal(); if (cur().view === 'char') S.nav.pop(); await loadRoom(); }
  },
  revive: async ({ id }) => reloadAfter(() => api('masterSetAlive', { charId: Number(id), alive: true }), 'Персонажа повернуто до життя'),
  markDead: async () => {
    const ch = currentChar();
    if (!(await confirmBox(`${ch.sheet.name} загинув? Гравець зможе створити нового персонажа.`))) return;
    const ok = await run(() => api('masterSetAlive', { charId: ch.id, alive: false }), '☠ Персонаж загинув');
    if (ok) { closeModal(); S.nav.pop(); await loadRoom(); }
  },

  openLog: async () => { S.log = null; go('log'); loadLog(); },
  logToggle: ({ all }) => { S.logAll = all === '1'; S.log = null; render(); loadLog(); },
  exportLog: async () => { await run(() => api('exportLog', { roomId: roomId(), all: S.logAll }), '📥 Файл надіслано в чат із ботом'); },
  endSession: async () => {
    const n = S.room.room.session;
    if (!(await confirmBox(`Завершити сесію ${n}? Події закриються, усе стиснеться до підсумку — він прийде файлом у чат. Детальний журнал і кидки сесії буде видалено (спершу можна надіслати їх із «📜 Журнал»).`))) return;
    const r = await run(() => api('endSession', { roomId: roomId() }));
    if (r) {
      toast(r.sent ? `🏁 Сесію ${n} завершено. Підсумок надіслано в чат.` : `Сесію завершено, але файл не надіслано — натисни Start у чаті з ботом. Підсумок збережено в «📜 Журнал → Увесь журнал».`, !r.sent);
      await loadRoom(true);
      if (cur().view === 'log') { S.log = null; render(); loadLog(); }
    }
  },

  // --- Створення персонажа ---
  startCreate: () => { S.wiz = newWizard(); go('create'); },
  askMaster: async ({ cancel }) => {
    const r = await run(() => api('askMaster', { roomId: roomId(), cancel: !!cancel }), cancel ? 'Прохання скасовано' : '🙋 Майстер отримав прохання');
    if (r) { S.room.helpRequested = r.helpRequested; render(); }
  },
  helpCreate: ({ uid }) => {
    const p = S.room && S.room.players.find((x) => String(x.userId) === String(uid));
    if (!p || p.character) { toast('У гравця вже є інший живий персонаж', true); return; }
    S.wiz = newWizard(p);
    go('create');
  },
  wizStep: ({ d }) => {
    const w = S.wiz;
    if (Number(d) > 0) {
      const bad = wizFirstError(w.step);
      if (bad) {
        toast(bad.err, true);
        if (bad.step !== w.step) { w.step = bad.step; render(); window.scrollTo(0, 0); }
        return;
      }
    }
    w.step = Math.max(1, Math.min(wizSteps().length, w.step + Number(d)));
    render(); window.scrollTo(0, 0);
  },
  wizAsiMode: ({ l, m }) => { S.wiz.asi[l] = { mode: m, asi: {}, feat: { id: '', ability: '', skills: [] } }; render(); },
  wizAsi: ({ l, a, d }) => {
    const st = S.wiz.asi[l];
    const snaps = {};
    R.buildCharacter(wizInput({ asi: { ...S.wiz.asi, [l]: { mode: 'asi', asi: {} } } }), { snaps, partial: true });
    const base = snaps[l] ? snaps[l].abilities[a] : 0;
    const sum = Object.values(st.asi).reduce((t, v) => t + v, 0);
    const v = (st.asi[a] || 0) + Number(d);
    if (v < 0 || v > 2) return;
    if (Number(d) > 0 && sum >= 2) { toast('Вже розподілено 2 очки', true); return; }
    if (base + v > 20) { toast('Максимум 20', true); return; }
    if (v) st.asi[a] = v; else delete st.asi[a];
    render();
  },
  wizFeatAbility: ({ l, a }) => { S.wiz.asi[l].feat.ability = a; render(); },
  wizGold: ({ v }) => { S.wiz.equip.gold = v === '1'; render(); },
  wizEquipOpt: ({ g, o }) => { S.wiz.equip.opts[Number(g)] = Number(o); tapFx(); render(); },
  wizMethod: ({ m }) => { S.wiz.method = m; S.wiz.assign = {}; render(); },
  roll: async () => {
    if (S.wiz.rolls && !(await confirmBox('Перекинути кубики? Майстер побачить обидва кидки в журналі.'))) return;
    const forUserId = S.wiz.forUserId;
    const r = await run(() => api('rollAbilities', { roomId: roomId(), forUserId }));
    if (r) {
      S.wiz.rolls = r.rolls; S.wiz.assign = {};
      if (forUserId) { const p = S.room.players.find((x) => x.userId === forUserId); if (p) p.lastRoll = r.rolls; } else if (S.room) S.room.lastRoll = r.rolls;
      render();
    }
  },
  pb: ({ a, d }) => {
    const w = S.wiz;
    const v = w.pb[a] + Number(d);
    if (v < 8 || v > 15) return;
    const old = w.pb[a];
    w.pb[a] = v;
    if (pbSpent() > R.POINT_BUY_TOTAL) { w.pb[a] = old; toast('Недостатньо очок', true); return; }
    render();
  },
  wizRaceChoice: ({ a }) => {
    const w = S.wiz;
    const race = R.RACES[w.raceId];
    if (w.raceChoice.includes(a)) w.raceChoice = w.raceChoice.filter((x) => x !== a);
    else if (w.raceChoice.length < race.choose.count) w.raceChoice.push(a);
    render();
  },
  wizPick: ({ list, k, max }) => {
    const w = S.wiz;
    const arr = w[list];
    if (arr.includes(k)) w[list] = arr.filter((x) => x !== k);
    else if (arr.length < Number(max)) arr.push(k);
    render();
  },
  createChar: async () => {
    const w = S.wiz;
    const bad = wizFirstError(wizSteps().length);
    if (bad) { toast(bad.err, true); if (bad.step !== w.step) { w.step = bad.step; render(); window.scrollTo(0, 0); } return; }
    const forUserId = w.forUserId;
    const r = await run(() => api('createCharacter', { roomId: roomId(), method: w.method, input: wizInput(), forUserId }),
      forUserId ? `🎉 Персонажа створено для гравця ${w.forName}` : '🎉 Персонажа створено!');
    if (r) { S.wiz = null; S.nav.pop(); if (!forUserId) S.tab = 'sheet'; await loadRoom(); }
  },

  // --- Хіти й стан ---
  hpModal: () => openModal({ type: 'hp', amount: '' }),
  hpApply: async ({ k }) => {
    const ch = currentChar();
    const s = ch.sheet;
    const n = Math.max(0, Math.trunc(num(S.modal.amount)));
    if (!n && k !== 'temp') { toast('Вкажи кількість', true); return; }
    const patch = k === 'dmg' ? { damage: n } : k === 'heal' ? { heal: n } : { hpTemp: n };
    if (k === 'heal' && s.hp.cur >= s.hp.max) { toast('Хіти вже повні'); return; }
    const ok = await reloadAfter(() => updateTrackers(ch, patch));
    if (ok) { S.modal.amount = ''; renderModal(); }
  },
  dsStep: async ({ k, d }) => {
    const ch = currentChar();
    const v = Math.max(0, Math.min(3, ch.sheet.deathSaves[k] + Number(d)));
    await reloadAfter(() => updateTrackers(ch, k === 's' ? { deathS: v } : { deathF: v }));
  },
  hdStep: async ({ d }) => {
    const ch = currentChar();
    const v = Math.max(0, Math.min(ch.sheet.level, ch.sheet.hitDiceUsed + Number(d)));
    await reloadAfter(() => updateTrackers(ch, { hitDiceUsed: v }));
  },
  insp: async ({ d }) => {
    const ch = currentChar();
    if (Number(d) < 0 && !R.inspCount(ch.sheet)) return;
    tapFx();
    await reloadAfter(() => updateTrackers(ch, { inspDelta: Number(d) }), Number(d) > 0 ? '⭐ Натхнення додано' : 'Натхнення забрано');
  },
  featInfo: ({ i }) => openModal({ type: 'featInfo', i: Number(i) }),
  resInfo: ({ id }) => openModal({ type: 'resInfo', id }),
  rest: async ({ kind }) => {
    const ch = currentChar();
    const txt = kind === 'long' ? 'Довгий відпочинок: повні хіти, комірки заклять і ресурси, половина костей хітів.' : 'Короткий відпочинок: відновлюються ресурси ☕ (і комірки чаклуна), гравець зможе витратити кості хітів.';
    if (!(await confirmBox(`${ch.sheet.name}. ${txt}`))) return;
    await reloadAfter(() => api('masterRest', { charId: ch.id, kind }), kind === 'long' ? '🌙 Довгий відпочинок' : '☕ Короткий відпочинок');
  },
  restAll: async ({ kind }) => {
    const txt = kind === 'long' ? 'Довгий відпочинок для всіх персонажів кімнати?' : 'Короткий відпочинок для всіх? Гравці зможуть витратити кості хітів.';
    if (!(await confirmBox(txt))) return;
    const r = await reloadAfter(() => api('masterRest', { roomId: roomId(), kind }));
    if (r) toast(`${kind === 'long' ? '🌙' : '☕'} Відпочинок для ${r.count} персонажів`);
  },
  spendHD: async () => {
    const ch = currentChar();
    const r = await reloadAfter(() => api('spendHitDie', { charId: ch.id }));
    if (r) toast(`🎲 Випало ${r.roll}: +${r.heal} ХП. Костей хітів лишилось: ${r.left}`);
  },
  endRest: async () => { const ch = currentChar(); await reloadAfter(() => api('endShortRest', { charId: ch.id }), 'Відпочинок завершено'); },
  res: async ({ id, j }) => {
    const ch = currentChar();
    const r = R.sheetResources(ch.sheet).find((x) => x.id === id);
    const idx = Number(j);
    const v = idx < r.used ? idx : idx + 1;
    if (v < r.used && !isMaster()) { toast('Ресурси відновлюються на відпочинку, який оголошує майстер'); return; }
    tapFx();
    await reloadAfter(() => updateTrackers(ch, { resId: id, resUsed: v }));
  },
  poolModal: ({ id }) => {
    const r = R.sheetResources(currentChar().sheet).find((x) => x.id === id);
    openModal({ type: 'pool', id, amount: isMaster() ? r.used : '' });
  },
  poolSave: async () => {
    const ch = currentChar();
    const m = S.modal;
    const r = R.sheetResources(ch.sheet).find((x) => x.id === m.id);
    const n = Math.max(0, Math.trunc(num(m.amount)));
    const v = isMaster() ? n : r.used + n;
    if (!isMaster() && !n) { toast('Вкажи кількість', true); return; }
    const ok = await reloadAfter(() => updateTrackers(ch, { resId: m.id, resUsed: v }));
    if (ok) closeModal();
  },
  slot: async ({ l, j }) => {
    const ch = currentChar();
    const i = Number(l);
    const idx = Number(j);
    const usedNow = (ch.sheet.spell.slotsUsed || [])[i] || 0;
    if (idx < usedNow && !isMaster()) { toast('Комірки відновлюються на відпочинку, який оголошує майстер'); return; }
    tapFx();
    await reloadAfter(() => updateTrackers(ch, { slotLevel: i, slotUsed: idx < usedNow ? idx : idx + 1 }));
  },

  // --- Закляття ---
  spellModal: ({ id, sid }) => openModal({ type: 'spell', id, sid }),
  spellInfo: ({ sid }) => { if (sid) openModal({ type: 'spellInfo', sid }); },
  spellPick: async () => {
    busy(true);
    await loadRoom(true);
    busy(false);
    const ch = currentChar();
    if (!ch) return;
    const list = clone(ch.sheet.spell.spells || []);
    S.pick = { mode: isMaster() ? 'master' : 'player', list, orig: clone(list), pool: '', q: '', lvl: 'all' };
    go('spellPick', { charId: ch.id });
  },
  spPool: ({ p }) => { const st = pickCtx().st; st.pool = p; st.lvl = 'all'; render(); },
  spLvl: ({ l }) => { pickCtx().st.lvl = l; render(); },
  spToggle: ({ sid }) => {
    const ctx = pickCtx();
    const plan = R.spellPlan(ctx.sheet);
    const pool = pickPools(ctx, plan).find((t) => t.id === ctx.st.pool);
    const list = ctx.st.list;
    const i = list.findIndex((x) => x.sid === sid && (x.pool === pool.id || (pool.id === 'extra' && x.by === 'm')));
    if (i >= 0) {
      if (!canDropSpell(ctx, list[i], plan)) { toast(plan.canSwap && list[i].pool === 'known' ? 'Замінити можна лише одне відоме закляття за підвищення рівня' : list[i].pool === 'prep' ? 'Підготовку можна змінити після довгого відпочинку' : 'Це закляття може прибрати лише майстер', true); return; }
      list.splice(i, 1);
    } else {
      const sp = R.SPELLS[sid];
      if (pool.id !== 'extra') {
        if (pool.used >= pool.count) { toast(`${pool.name}: вже обрано ${pool.count}`, true); return; }
        if (pool.id === 'prep' && ctx.mode === 'player' && !plan.prepOpen) { toast('Підготовку можна змінити після довгого відпочинку', true); return; }
        if (pool.offList && !sp.classes.some((c) => pool.lists.includes(c)) && !(pool.extra || []).includes(sid)
          && list.filter((x) => x.pool === pool.id && x.sid && !R.SPELLS[x.sid].classes.some((c) => pool.lists.includes(c))).length >= pool.offList) { toast(`${pool.offListName}: максимум ${pool.offList}`, true); return; }
        if (pool.schools && sp.level && !pool.schools.includes(sp.school)
          && list.filter((x) => x.pool === pool.id && x.sid && R.SPELLS[x.sid].level && !pool.schools.includes(R.SPELLS[x.sid].school)).length >= pool.offSchool) { toast(`Інших шкіл — максимум ${pool.offSchool}`, true); return; }
      }
      list.push({ id: `n${Math.random().toString(36).slice(2, 9)}`, sid, pool: pool.id, name: sp.name, level: sp.level, prepared: pool.id === 'prep', ...(pool.id === 'extra' ? { by: 'm' } : {}) });
    }
    tapFx();
    render();
  },
  spPrep: ({ id }) => {
    const ctx = pickCtx();
    const plan = R.spellPlan(ctx.sheet);
    if (ctx.mode === 'player' && !plan.prepOpen) { toast('Підготовку можна змінити після довгого відпочинку або підвищення рівня', true); return; }
    const e = ctx.st.list.find((x) => x.id === id);
    if (!e) return;
    if (!e.prepared && ctx.mode !== 'master' && ctx.st.list.filter((x) => x.prepared && x.level > 0).length >= plan.prep.max) { toast(`Підготовлених — максимум ${plan.prep.max}`, true); return; }
    e.prepared = !e.prepared;
    tapFx();
    render();
  },
  spSave: async () => {
    const ch = currentChar();
    const ok = await reloadAfter(() => api('spells', { charId: ch.id, spells: S.pick.list }), 'Закляття збережено');
    if (ok) { S.pick = null; S.nav.pop(); render(); }
  },
  spellForm: ({ id }) => {
    const ch = currentChar();
    const sp = id && ch.sheet.spell.spells.find((x) => x.id === id);
    openModal({ type: 'spellForm', id: id || null, form: sp ? clone(sp) : { name: '', level: 0, school: '', time: '1 дія', range: '', comp: '', dur: '', desc: '', prepared: false, conc: false, ritual: false } });
  },
  saveSpell: async () => {
    const ch = currentChar();
    const f = S.modal.form;
    if (!String(f.name || '').trim()) { toast('Вкажи назву', true); return; }
    const list = clone(ch.sheet.spell.spells || []);
    f.level = num(f.level);
    if (S.modal.id) { const i = list.findIndex((x) => x.id === S.modal.id); list[i] = f; } else list.push({ ...f, id: Math.random().toString(36).slice(2, 10) });
    const ok = await reloadAfter(() => api('spells', { charId: ch.id, spells: list }), 'Збережено');
    if (ok) closeModal();
  },
  deleteSpell: async ({ id }) => {
    const ch = currentChar();
    if (!(await confirmBox('Видалити закляття?'))) return;
    const ok = await reloadAfter(() => api('spells', { charId: ch.id, spells: ch.sheet.spell.spells.filter((x) => x.id !== id) }), 'Видалено');
    if (ok) closeModal();
  },
  togglePrep: async ({ id }) => {
    const ch = currentChar();
    const list = clone(ch.sheet.spell.spells);
    const sp = list.find((x) => x.id === id);
    sp.prepared = !sp.prepared;
    tapFx();
    await reloadAfter(() => api('spells', { charId: ch.id, spells: list }));
  },

  // --- Тексти ---
  editText: ({ fields }) => {
    const ch = currentChar();
    const list = fields === 'info' ? ['age', 'height', 'weight', 'eyes', 'skin', 'hair'] : fields.split(',');
    const vals = {};
    for (const k of list) vals[k] = ch.sheet.text[k] || '';
    openModal({ type: 'text', fields: list, vals });
  },
  saveText: async () => {
    const ch = currentChar();
    const ok = await reloadAfter(() => api('textInfo', { charId: ch.id, text: S.modal.vals }), 'Збережено');
    if (ok) closeModal();
  },

  // --- Предмети ---
  itemModal: async ({ id }) => {
    if (isMaster()) { busy(true); await loadRoom(true); busy(false); }
    const ch = currentChar();
    const it = ch && (ch.items || []).find((x) => x.id === Number(id));
    if (!it) { toast('Предмета вже немає', true); return; }
    openModal({ type: 'item', id: it.id, qty: isMaster() ? it.qty : 1 });
  },
  qtyStep: ({ d, max, min }) => {
    const m = S.modal;
    let v = num(m.qty, 1) + Number(d);
    const lo = min !== undefined ? Number(min) : 1;
    v = Math.max(lo, v);
    if (max !== undefined) v = Math.min(Number(max), v);
    m.qty = v;
    renderModal();
  },
  useItem: async () => {
    const m = S.modal;
    const ch = currentChar();
    const it = ch.items.find((x) => x.id === m.id);
    const n = Math.max(1, Math.min(it.qty, Math.trunc(num(m.qty, 1))));
    const r = await reloadAfter(() => api('useItem', { itemId: m.id, qty: n }), `Використано: ${it.data.name} ×${n}`);
    if (r !== undefined) { if (r.left === 0) closeModal(); else { S.modal.qty = 1; renderModal(); } }
  },
  equip: async () => {
    const ch = currentChar();
    const it = ch.items.find((x) => x.id === S.modal.id);
    await reloadAfter(() => api('equipItem', { itemId: it.id, equipped: !it.equipped }));
  },
  attune: async () => {
    const ch = currentChar();
    const it = ch.items.find((x) => x.id === S.modal.id);
    await reloadAfter(() => api('equipItem', { itemId: it.id, attuned: !it.attuned }));
  },
  dropItem: async () => {
    const ch = currentChar();
    const it = ch.items.find((x) => x.id === S.modal.id);
    if (!(await confirmBox(`Викинути «${it.data.name}» ×${it.qty}? Майстер отримає сповіщення.`))) return;
    const ok = await reloadAfter(() => api('dropItem', { itemId: it.id }), 'Предмет викинуто');
    if (ok) closeModal();
  },
  giveItemModal: () => openModal({ type: 'give', itemId: S.modal.id, to: '', qty: 1 }),
  giveItem: async () => {
    const m = S.modal;
    if (!m.to) { toast('Обери, кому передати', true); return; }
    const ok = await reloadAfter(() => api('giveItem', { itemId: m.itemId, toCharId: Number(m.to), qty: Math.trunc(num(m.qty, 1)) }), 'Передано');
    if (ok) closeModal();
  },
  masterQty: async () => {
    const m = S.modal;
    const q = Math.max(0, Math.trunc(num(m.qty)));
    const ok = await reloadAfter(() => api('masterEditItem', { itemId: m.id, qty: q }), 'Кількість змінено');
    if (ok && q === 0) closeModal();
  },
  removeItem: async () => {
    const ch = currentChar();
    const it = ch.items.find((x) => x.id === S.modal.id);
    if (!(await confirmBox(`Забрати «${it.data.name}» ×${it.qty} у гравця?`))) return;
    const ok = await reloadAfter(() => api('masterRemoveItem', { itemId: it.id }), 'Предмет забрано');
    if (ok) closeModal();
  },
  editItemForm: () => {
    const ch = currentChar();
    const it = ch.items.find((x) => x.id === S.modal.id);
    openModal({ type: 'itemForm', mode: 'edit', itemId: it.id, charId: ch.id, form: clone(it.data), qty: it.qty });
  },
  openCatalog: () => { closeModal(); S.cat = { q: '', group: 'all', rarity: 'all' }; go('catalog', { charId: currentChar().id }); loadMyItems(); },
  openMyCatalog: () => { S.cat = { q: '', group: 'all', rarity: 'all' }; go('catalog', {}); loadMyItems(); },
  myNewItem: () => openModal({ type: 'itemForm', mode: 'myNew', form: itemFormBlank(), qty: 1 }),
  copyToMine: ({ id }) => {
    const form = clone(CATALOG.find((x) => x.catalogId === id));
    delete form.group;
    openModal({ type: 'itemForm', mode: 'myNew', form, qty: 1 });
  },
  deleteMyItem: async () => {
    const m = S.modal;
    if (!(await confirmBox(`Видалити «${m.form.name}» з каталогу? Уже видані гравцям предмети залишаться.`))) return;
    const ok = await run(() => api('deleteMyItem', { id: m.myId }), 'Видалено з каталогу');
    if (ok) { closeModal(); await loadMyItems(); }
  },
  catGroup: ({ g }) => { S.cat.group = g; render(); },
  catRarity: ({ r }) => { S.cat.rarity = r; render(); },
  catPick: ({ id }) => {
    const manage = !cur().charId;
    const mine = myCatalog().find((x) => x.catalogId === id);
    if (manage && !mine) { openModal({ type: 'catView', id }); return; }
    const it = mine || CATALOG.find((x) => x.catalogId === id);
    const form = clone(it);
    for (const k of ['group', 'myId', 'srcId']) delete form[k];
    form.catalogId = mine ? it.srcId || '' : it.catalogId;
    if (manage) openModal({ type: 'itemForm', mode: 'myEdit', myId: mine.myId, form, qty: 1 });
    else openModal({ type: 'itemForm', mode: 'issue', charId: cur().charId, form, qty: 1 });
  },
  customItem: () => openModal({ type: 'itemForm', mode: 'custom', charId: currentChar().id, form: itemFormBlank(), qty: 1, saveMine: true }),
  saveItemForm: async () => {
    const m = S.modal;
    if (!String(m.form.name || '').trim()) { toast('Вкажи назву предмета', true); return; }
    if (m.mode === 'edit') {
      const ok = await reloadAfter(() => api('masterEditItem', { itemId: m.itemId, item: m.form }), 'Предмет змінено');
      if (ok) closeModal();
      return;
    }
    if (m.mode === 'myNew' || m.mode === 'myEdit') {
      const ok = await run(() => api('saveMyItem', { id: m.mode === 'myEdit' ? m.myId : undefined, item: m.form }), '📦 Збережено в каталог');
      if (ok) { closeModal(); await loadMyItems(); }
      return;
    }
    if (m.mode === 'custom' && m.saveMine) { api('saveMyItem', { item: m.form }).then(() => loadMyItems()).catch(() => {}); }
    const ch = currentChar();
    const q = Math.max(1, Math.trunc(num(m.qty, 1)));
    const ok = await reloadAfter(() => api('masterAddItem', { charId: m.charId, item: m.form, qty: q }), `🎁 Видано ${ch ? ch.sheet.name : ''}: ${m.form.name} ×${q}`);
    if (ok) closeModal();
  },

  // --- Гроші ---
  moneyModal: async ({ mode }) => {
    if (mode === 'set') { busy(true); await loadRoom(true); busy(false); }
    const ch = currentChar();
    if (!ch) return;
    openModal({ type: 'money', mode, to: '', vals: mode === 'set' ? { ...ch.sheet.money } : {} });
  },
  moneySave: async () => {
    const m = S.modal;
    const ch = currentChar();
    const vals = {};
    for (const k of R.COINS) vals[k] = Math.max(0, Math.trunc(num(m.vals[k])));
    let ok;
    if (m.mode === 'set') ok = await reloadAfter(() => api('masterMoney', { charId: ch.id, money: vals }), 'Гроші змінено');
    else if (m.mode === 'spend') ok = await reloadAfter(() => api('spendMoney', { charId: ch.id, money: vals }), 'Витрачено');
    else {
      if (!m.to) { toast('Обери, кому передати', true); return; }
      ok = await reloadAfter(() => api('giveMoney', { charId: ch.id, toCharId: Number(m.to), money: vals }), 'Передано');
    }
    if (ok) closeModal();
  },

  // --- Майстер: досвід, рівень, редактор ---
  xpModal: () => openModal({ type: 'xp', amount: '' }),
  // події
  // за замовчуванням — усі, хто зараз поза подіями
  eventStartModal: () => openModal({ type: 'eventStart', name: '', evType: 'combat',
    chars: roomChars(S.room).filter((ch) => !charEvent(S.room, ch.id)).map((ch) => String(ch.id)) }),
  eventType: ({ k }) => { S.modal.evType = k; renderModal(); },
  eventStart: async () => {
    const m = S.modal;
    if (!m.chars.length) { toast('Обери хоча б одного учасника', true); return; }
    const r = await reloadAfter(() => api('startEvent', { roomId: roomId(), name: m.name, type: m.evType, charIds: m.chars.map(Number) }), '⚔️ Подію розпочато — дії учасників записуються');
    if (r) { closeModal(); if (r.merged && r.merged.length) toast(`🔗 Подія «${r.merged.join('», «')}» перетекла в нову`); }
  },
  eventMembersModal: ({ id }) => {
    const ev = findEv(id);
    if (ev) openModal({ type: 'eventMembers', eventId: ev.id, name: ev.name, chars: ev.members.map(String) });
  },
  eventMembersSave: async () => {
    const m = S.modal;
    if (!m.chars.length && !(await confirmBox(`Прибрати всіх учасників? Подія «${m.name}» завершиться, а звіт прийде файлом у чат з ботом.`))) return;
    const r = await reloadAfter(() => api('eventMembers', { roomId: roomId(), eventId: m.eventId, charIds: m.chars.map(Number) }));
    if (!r) return;
    closeModal();
    if (r.finished) toast(r.sent ? '📊 Подію завершено — звіт надіслано в чат' : 'Подію завершено, але файл не надіслано — відкрий чат із ботом і натисни «Почати» (Start)', !r.sent);
    else if (r.merged && r.merged.length) toast(`🔗 Подія «${r.merged.join('», «')}» перетекла в цю`);
    else toast('Збережено');
  },
  eventMergeModal: ({ id }) => {
    const ev = findEv(id);
    const others = (S.room.room.events || []).filter((e) => e.id !== Number(id));
    if (ev && others.length) openModal({ type: 'eventMerge', eventId: ev.id, name: ev.name, intoId: others.length === 1 ? others[0].id : 0 });
  },
  eventMergePick: ({ id }) => { S.modal.intoId = Number(id); renderModal(); },
  eventMergeSave: async () => {
    const m = S.modal;
    if (!m.intoId) { toast('Обери подію', true); return; }
    const r = await reloadAfter(() => api('mergeEvent', { roomId: roomId(), eventId: m.eventId, intoId: m.intoId }));
    if (r) { closeModal(); toast(`🔗 Події об’єднано в «${r.name}»`); }
  },
  eventEnd: async ({ id }) => {
    const ev = findEv(id);
    if (!ev) return;
    if (!(await confirmBox(`Завершити подію «${ev.name}»? Звіт прийде файлом у чат з ботом.`))) return;
    if (S.evRolls) delete S.evRolls[ev.id];
    await reloadAfter(() => api('endEvent', { roomId: roomId(), eventId: ev.id }), '📊 Звіт події надіслано в чат');
  },
  eventRolls: ({ id }) => { S.evRolls = S.evRolls || {}; S.evRolls[id] = !S.evRolls[id]; render(); },
  // ---- ефекти ----
  fxAddModal: () => {
    const ch = currentChar();
    if (!ch) return;
    openModal({ type: 'fxAdd', charId: ch.id, sel: '', n: 10, unit: 'round' });
    loadMyEffects();
  },
  fxPick: ({ id }) => {
    const m = S.modal;
    m.sel = id;
    const [kind, k] = id.split(':');
    const d = kind === 'k' ? R.EFFECTS[k].def : ((S.myEffects || []).find((x) => String(x.id) === k) || { data: {} }).data.def;
    if (d) { m.unit = d.unit; m.n = d.unit === 'perm' ? 10 : d.n; }
    renderModal();
  },
  fxUnit: ({ k }) => { S.modal.unit = k; if (k !== 'perm' && !(S.modal.n > 0)) S.modal.n = 1; renderModal(); },
  fxN: ({ d }) => {
    const m = S.modal;
    const max = m.unit === 'lvl' ? 6 : 999;
    m.n = Math.max(1, Math.min(max, (Number(m.n) || 0) + Number(d)));
    renderModal();
  },
  fxApply: async () => {
    const m = S.modal;
    const [kind, id] = String(m.sel).split(':');
    if (!id) return;
    const p = { charId: m.charId, n: Number(m.n) || 1, unit: m.unit };
    if (kind === 'k') p.key = id; else p.myId = Number(id);
    const r = await reloadAfter(() => api('addEffect', p), '✨ Статус накладено');
    if (r) closeModal();
  },
  fxStep: ({ id, d }) => reloadAfter(() => api('stepEffect', { effectId: Number(id), delta: Number(d) })).then((r) => { if (r && r.removed) toast('Статус закінчився і знятий'); }),
  fxRemove: async ({ id }) => {
    hideTip();
    const r = await reloadAfter(() => api('removeEffect', { effectId: Number(id) }));
    if (r) toast('Статус знято');
  },
  fxInfo: ({ id }, el) => {
    const ch = currentChar();
    const e = ch && (ch.effects || []).find((x) => x.id === Number(id));
    if (!e) return;
    const d = fxView(e);
    const M = S.room && S.room.role === 'master' && !isRO();
    showTip(el, `${d.icon} ${d.std ? t(d.name) : d.name}`, `<div class="hint" data-notr>⏳ ${esc(fxLeft(e))}</div>
      ${d.desc ? `<p style="margin:6px 0 0"${d.std ? '' : ' data-notr'}>${esc(d.desc)}</p>` : ''}
      ${M ? `<button class="btn sm danger mt" data-act="fxRemove" data-id="${e.id}">Зняти статус</button>` : ''}`);
  },
  // каталог: свої ефекти
  catKind: ({ k }) => { S.cat.kind = k === 'effects' ? 'effects' : 'items'; render(); if (S.cat.kind === 'effects') loadMyEffects(); },
  fxNew: () => openModal({ type: 'fxEdit', id: 0, form: { name: '', icon: '✨', desc: '' }, n: 10, unit: 'round' }),
  fxEditMine: ({ id }) => {
    const x = (S.myEffects || []).find((y) => y.id === Number(id));
    if (!x) return;
    const d = x.data.def || { n: 10, unit: 'round' };
    openModal({ type: 'fxEdit', id: x.id, form: { name: x.data.name, icon: x.data.icon, desc: x.data.desc || '' }, n: d.unit === 'perm' ? 10 : d.n, unit: d.unit });
  },
  fxIcon: ({ i }) => { S.modal.form.icon = i; renderModal(); },
  fxSave: async () => {
    const m = S.modal;
    if (!m.form.name.trim()) { toast('Вкажи назву ефекту', true); return; }
    const ok = await run(() => api('saveMyEffect', { id: m.id || undefined, effect: { ...m.form, def: { n: Number(m.n) || 1, unit: m.unit } } }), '📦 Збережено в каталог');
    if (ok) { closeModal(); await loadMyEffects(); }
  },
  fxDelete: async () => {
    const m = S.modal;
    if (!(await confirmBox(`Видалити ефект «${m.form.name}» з каталогу? Уже накладені на персонажів залишаться.`))) return;
    const ok = await run(() => api('deleteMyEffect', { id: m.id }), 'Видалено з каталогу');
    if (ok) { closeModal(); await loadMyEffects(); }
  },
  fxStdInfo: ({ k }, el) => {
    const d = R.EFFECTS[k];
    if (d) showTip(el, `${d.icon} ${t(d.name)}`, `<p style="margin:0">${esc(d.desc)}</p>`);
  },
  rollMark: ({ id, m }) => reloadAfter(() => api('markRoll', { roomId: roomId(), rollId: Number(id), mark: Number(m) })),
  rollDel: async ({ id }) => {
    const r = ((S.room && S.room.room.rolls) || []).find((x) => x.id === Number(id))
      || ((S.room && S.room.room.events) || []).flatMap((e) => e.rolls || []).find((x) => x.id === Number(id));
    if (!r) return;
    if (!(await confirmBox(`Видалити кидок «${r.label}» (${r.total}) — ${r.charName || r.name}? Він зникне з історії гравця, журналу й звітів.`))) return;
    await reloadAfter(() => api('deleteRoll', { roomId: roomId(), rollId: r.id }), 'Кидок видалено');
  },
  mtab: ({ tab }) => {
    S.mtab = tab === 'dice' ? 'dice' : 'room';
    render();
    if (S.mtab === 'dice') loadRoom(true);
  },
  rollFilter: ({ id }) => { S.rollFilter = Number(id) || 0; render(); },
  rollMore: () => { S.rollLimit += 50; loadRoom(true); },
  eventAdjModal: ({ id, name }) => openModal({ type: 'eventAdj', charId: Number(id), name, amount: '', note: '' }),
  eventAdjQuick: ({ n }) => { S.modal.amount = String(num(S.modal.amount) + Number(n)); renderModal(); },
  eventAdjSave: async () => {
    const m = S.modal;
    const n = Math.trunc(num(m.amount));
    if (!n) { toast('Вкажи кількість', true); return; }
    const r = await reloadAfter(() => api('eventDamage', { roomId: roomId(), charId: m.charId, delta: n, note: m.note }), 'Збережено');
    if (r) closeModal();
  },
  xpQuick: ({ n }) => { S.modal.amount = String(num(S.modal.amount) + Number(n)); renderModal(); },
  xpSave: async () => {
    const ch = currentChar();
    const n = Math.trunc(num(S.modal.amount));
    if (!n) { toast('Вкажи кількість досвіду', true); return; }
    const r = await reloadAfter(() => api('masterXP', { charId: ch.id, amount: n }), `⭐ ${n > 0 ? '+' : ''}${n} досвіду`);
    if (r) closeModal();
  },
  grantLevel: async () => {
    const ch = currentChar();
    const s = ch.sheet;
    const target = Math.max(s.targetLevel, s.level) + 1;
    if (!(await confirmBox(`Дозволити ${s.name} підвищення до ${target} рівня? Гравець пройде підвищення за правилами 5e.`))) return;
    await reloadAfter(() => api('masterGrantLevel', { charId: ch.id }), `⬆️ Дозволено ${target} рівень`);
  },
  charMore: () => openModal({ type: 'charMore' }),
  editSheet: async () => {
    busy(true);
    await loadRoom(true);
    busy(false);
    const ch = currentChar();
    if (!ch) return;
    S.editOrig = clone(ch.sheet);
    S.edit = clone(ch.sheet);
    if (!S.edit.prof) S.edit.prof = R.profOf(ch.sheet);
    go('editSheet', { charId: ch.id });
  },
  toggleSlotsOverride: () => {
    const e = S.edit;
    e.spell.slotsOverride = Array.isArray(e.spell.slotsOverride) ? null : (() => { const a = R.sheetSlots({ ...e, spell: { slotsOverride: null } }); while (a.length < 9) a.push(0); return a; })();
    render();
  },
  saveSheetEdit: async () => {
    const ch = currentChar();
    const patch = sheetPatch(S.editOrig, S.edit);
    if (!Object.keys(patch).length) { toast('Змін немає'); S.edit = null; S.nav.pop(); render(); return; }
    const r = await run(() => api('masterSaveSheet', { charId: ch.id, sheet: patch }));
    if (r) { toast(r.changed ? `💾 Збережено змін: ${r.changed}` : 'Змін немає'); S.edit = null; S.editOrig = null; S.nav.pop(); await loadRoom(); }
  },

  // --- Підвищення рівня ---
  openLevelUp: () => openModal({ type: 'levelUp', hpMethod: 'avg', asiMode: 'asi', asi: {}, feat: { id: '', ability: '', skills: [] }, expertise: [], subclassId: '', choices: {} }),
  pickSubclass: ({ path, k }) => { setPath(path, k); tapFx(); rerenderFor(path); },
  pickChoice: ({ path, spec, k, max }) => {
    const picks = getPath(path);
    const arr = picks[spec] || [];
    if (arr.includes(k)) picks[spec] = arr.filter((x) => x !== k);
    else if (Number(max) === 1) picks[spec] = [k];
    else if (arr.length < Number(max)) picks[spec] = [...arr, k];
    tapFx();
    rerenderFor(path);
  },
  featAbility: ({ a }) => { S.modal.feat.ability = a; renderModal(); },
  lvHp: ({ m }) => { S.modal.hpMethod = m; renderModal(); },
  lvMode: ({ m }) => { S.modal.asiMode = m; S.modal.asi = {}; S.modal.feat = { id: '', ability: '', skills: [] }; renderModal(); },
  lvAsi: ({ a, d }) => {
    const m = S.modal;
    const s = currentChar().sheet;
    const sum = Object.values(m.asi).reduce((t, v) => t + v, 0);
    const v = (m.asi[a] || 0) + Number(d);
    if (v < 0 || v > 2) return;
    if (Number(d) > 0 && sum >= 2) { toast('Вже розподілено 2 очки', true); return; }
    if (s.abilities[a] + v > 20) { toast('Максимум 20', true); return; }
    m.asi[a] = v;
    if (!v) delete m.asi[a];
    renderModal();
  },
  lvExp: ({ k }) => {
    const m = S.modal;
    if (m.expertise.includes(k)) m.expertise = m.expertise.filter((x) => x !== k); else m.expertise.push(k);
    renderModal();
  },
  lvSubmit: async () => {
    const ch = currentChar();
    const m = S.modal;
    if (R.subclassNeeded(ch.sheet, ch.sheet.level + 1) && !m.subclassId) { toast(`Обери: ${R.CLASS_DATA[ch.sheet.classId].subclassLabel.toLowerCase()}`, true); return; }
    const r = await run(() => api('levelUp', {
      charId: ch.id, hpMethod: m.hpMethod, asi: m.asiMode === 'asi' ? m.asi : null, feat: m.asiMode === 'feat' ? m.feat : null,
      expertise: m.expertise, subclassId: m.subclassId, choices: m.choices,
    }));
    if (r) {
      closeModal();
      toast(`🎉 ${r.level} рівень! +${r.hpGain} ХП${m.hpMethod === 'roll' ? ` (на кубику ${r.die})` : ''}${r.features && r.features.length ? `\nНові вміння: ${r.features.length}` : ''}`);
      S.tab = 'spells';
      await loadRoom(true);
      render();
    }
  },

  // --- Вміння (майстер) ---
  featureForm: () => openModal({ type: 'featureForm', name: '', desc: '', lvl: currentChar().sheet.level }),
  saveFeature: async () => {
    const ch = currentChar();
    const m = S.modal;
    if (!String(m.name || '').trim()) { toast('Вкажи назву', true); return; }
    const list = [...(ch.sheet.features || []), { lvl: Math.trunc(num(m.lvl, 1)), name: m.name, desc: m.desc, src: 'custom' }];
    const ok = await reloadAfter(() => api('masterFeatures', { charId: ch.id, features: list }), 'Вміння додано');
    if (ok) closeModal();
  },
  delFeature: async ({ i }) => {
    const ch = currentChar();
    const f = ch.sheet.features[Number(i)];
    if (!(await confirmBox(`Прибрати вміння «${f.name}»?`))) return;
    await reloadAfter(() => api('masterFeatures', { charId: ch.id, features: ch.sheet.features.filter((_, k) => k !== Number(i)) }), 'Прибрано');
  },
  fillFeatures: async () => {
    const ch = currentChar();
    const tmp = clone(ch.sheet);
    delete tmp.features;
    R.gainLevelFeatures(tmp, tmp.level, {});
    const list = (tmp.features || []).filter((x) => x.src !== 'choice');
    if (!(await confirmBox(`Додати ${list.length} вмінь раси й класу для 1–${tmp.level} рівнів? Вибори (підклас, бойовий стиль тощо) гравець зробить при наступному підвищенні рівня.`))) return;
    await reloadAfter(() => api('masterFeatures', { charId: ch.id, features: list }), 'Вміння заповнено');
  },
  applyBaseWeapon: ({ value }) => {
    const w = BASE_WEAPONS.find((x) => x.id === value);
    if (!w) return;
    Object.assign(S.modal.form, { damage: w.damage, dmgType: w.dmgType, props: w.props, ranged: w.ranged, weight: w.weight, baseName: w.name, kind: w.id, cat: w.cat });
    renderModal();
  },
  armorCat: ({ value }) => {
    const f = S.modal.form;
    f.cat = value;
    // типові обмеження СПР: легкий — без меж, середній — +2, важкий — без СПР
    if (value === 'light') f.dexMax = '';
    if (value === 'medium') f.dexMax = 2;
    if (value === 'heavy') f.dexMax = 0;
    renderModal();
  },
};

async function loadMyEffects() {
  try {
    S.myEffects = (await api('myEffects')).effects;
  } catch (e) {
    if (S.myEffects === null) S.myEffects = [];
    toast(e.message, true);
  }
  if (S.modal && S.modal.type === 'fxAdd') renderModal();
  else if (cur().view === 'catalog') render();
}
async function loadMyItems() {
  try {
    const r = await api('myItems');
    S.myItems = r.items;
  } catch (e) {
    if (S.myItems === null) S.myItems = [];
    toast(e.message, true);
  }
  if (cur().view === 'catalog') render();
}

async function loadLog() {
  try {
    S.log = await api('logList', { roomId: roomId(), all: S.logAll });
    if (cur().view === 'log') render();
  } catch (e) { toast(e.message, true); }
}

// ================= Плашка-підказка для скорочень =================
const $tip = document.getElementById('tip');
function showTip(el, title, html) {
  $tip.innerHTML = `<button class="tip-x" data-act="tipClose" aria-label="Закрити">✕</button><b class="tip-t" data-notr>${esc(title)}</b><div class="tip-b">${html}</div>`;
  trTree($tip);
  $tip.hidden = false;
  const r = el.getBoundingClientRect();
  const w = Math.min(320, window.innerWidth - 16);
  $tip.style.width = `${w}px`;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  $tip.style.left = `${left}px`;
  const hgt = $tip.offsetHeight;
  const below = r.bottom + 8;
  $tip.style.top = `${below + hgt > window.innerHeight - 8 && r.top - hgt - 8 > 8 ? r.top - hgt - 8 : Math.min(below, window.innerHeight - hgt - 8)}px`;
}
function hideTip() { $tip.hidden = true; }
// на пристроях з мишкою підказка до значка події з'являється при наведенні
if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
  let tipEl = null;
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest('[data-act=evTip]');
    if (el && el !== tipEl) { tipEl = el; ACT.evTip({ ...el.dataset }, el); }
  });
  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest && e.target.closest('[data-act=evTip]');
    if (el && el === tipEl && !el.contains(e.relatedTarget)) { tipEl = null; hideTip(); }
  });
}

const RO_BLOCK = new Set(['slot', 'res', 'poolModal', 'togglePrep', 'spellForm', 'spellPick', 'spSave', 'spToggle', 'spPrep', 'editText', 'hpModal', 'insp', 'moneyModal', 'equip', 'attune', 'useItem',
  'dropItem', 'giveItemModal', 'openLevelUp', 'spendHD', 'endRest', 'featureForm', 'delFeature', 'fillFeatures', 'saveSpell', 'deleteSpell']);

document.addEventListener('toggle', (e) => { if (e.target.classList && e.target.classList.contains('archive')) S.archiveOpen = e.target.open; }, true);

// ================= Події =================
document.addEventListener('click', (e) => {
  if (!$tip.hidden && !e.target.closest('#tip') && !e.target.closest('[data-act=abbr],[data-act=skillInfo]')) hideTip();
  if (e.target.classList && e.target.classList.contains('overlay')) { closeModal(); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  if (isRO() && RO_BLOCK.has(el.dataset.act)) { e.preventDefault(); toast('Персонаж в архіві — лише перегляд'); return; }
  if (el.tagName !== 'INPUT') e.preventDefault();
  fn({ ...el.dataset }, el);
});

function setPath(path, val) {
  const ks = path.split('.');
  let o = S;
  for (let i = 0; i < ks.length - 1; i++) {
    if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
    o = o[ks[i]];
  }
  o[ks[ks.length - 1]] = val;
}
function elValue(el) {
  if (el.type === 'checkbox') return el.checked;
  if ('num' in el.dataset) return el.value === '' ? '' : Number(el.value);
  return el.value;
}
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.dataset || !el.dataset.bind || el.tagName === 'SELECT' || el.type === 'checkbox') return;
  setPath(el.dataset.bind, elValue(el));
  if (el.dataset.live === 'catalog') { const box = document.getElementById('catList'); if (box) box.innerHTML = catalogListHtml(); }
  if (el.dataset.live === 'spells') { const box = document.getElementById('spList'); if (box) box.innerHTML = spellRowsHtml(); return; }
  if (el.dataset.bind.startsWith('wiz.')) updateWizNav();
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (!el.dataset) return;
  if (el.dataset.arr) {
    const arr = getArr(el.dataset.arr);
    const v = el.dataset.v;
    const i = arr.indexOf(v);
    if (el.checked && i < 0) arr.push(v);
    if (!el.checked && i >= 0) arr.splice(i, 1);
    return;
  }
  if (el.dataset.onchange && ACT[el.dataset.onchange]) { ACT[el.dataset.onchange]({ value: el.value }); return; }
  if (!el.dataset.bind) return;
  setPath(el.dataset.bind, elValue(el));
  if (el.dataset.bind.startsWith('wiz.')) wizChanged(el.dataset.bind);
  if ('rerender' in el.dataset) { if (el.dataset.rerender === 'modal') renderModal(); else render(); }
  else if (el.dataset.bind.startsWith('wiz.')) updateWizNav();
});
function getArr(path) { return path.split('.').reduce((o, k) => o[k], S); }

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (S.roomId && S.nav.some((v) => v.view === 'room')) loadRoom(true);
  else if (['masterHome', 'playerHome'].includes(cur().view)) loadMe(true);
});

// ================= Старт =================
async function boot() {
  const saved = lsGet(LS_LANG);
  if (!tg || !tg.initData) {
    await applyLang(saved || langFromTg(navigator.language)).catch(() => {});
    reset('noTelegram');
    return;
  }
  try {
    tg.ready();
    tg.expand();
    if (tg.BackButton) tg.BackButton.onClick(back);
    if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) { tg.setHeaderColor('secondary_bg_color'); tg.setBackgroundColor('secondary_bg_color'); }
    if (tg.isVersionAtLeast && tg.isVersionAtLeast('7.7') && tg.disableVerticalSwipes) tg.disableVerticalSwipes();
  } catch (e) { /* старі клієнти */ }
  reset('loading');
  // словник збереженої мови вантажимо паралельно з даними користувача
  const early = saved && saved !== LANG ? applyLang(saved).catch(() => {}) : null;
  try {
    S.me = await api('me');
  } catch (e) {
    await early;
    S.bootError = e.message;
    reset('error');
    return;
  }
  await early;
  // мова з сервера (спільна для всіх пристроїв і сповіщень бота), інакше збережена тут
  const want = normLang(S.me.user.lang || saved || 'uk');
  if (want !== LANG) await applyLang(want).catch(() => {});
  lsSet(LS_LANG, LANG);
  if (S.me.user.lang !== LANG) { S.me.user.lang = LANG; api('setLang', { lang: LANG }).catch(() => {}); }
  const qs = new URLSearchParams(location.search);
  const raw = (tg.initDataUnsafe && tg.initDataUnsafe.start_param) || qs.get('room') || '';
  const invite = raw.toUpperCase().replace(/^(JOIN_|ROOM_)/, '').replace(/[^A-Z0-9]/g, '');
  if (invite && !S.bootInviteHandled) {
    S.bootInviteHandled = true;
    if (S.me.masterRooms.some((r) => r.id === invite)) { S.me.user.role = 'master'; S.nav = [{ view: 'role' }, { view: 'masterHome' }]; openRoom(invite); return; }
    if (S.me.playerRooms.some((r) => r.id === invite)) { S.me.user.role = 'player'; S.nav = [{ view: 'role' }, { view: 'playerHome' }]; openRoom(invite); return; }
    reset('role', 'playerHome', { view: 'join', code: invite });
    return;
  }
  reset('role');
}

boot();
