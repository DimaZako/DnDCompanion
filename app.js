// DnD Companion — Telegram Mini App
import * as R from './shared/rules.js';
import { CATALOG, BASE_WEAPONS } from './data/items.js';

const tg = window.Telegram && window.Telegram.WebApp;
const CFG = window.DND_CONFIG || {};
const API = String(CFG.API_URL || '').replace(/\/+$/, '');
const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');
const $toast = document.getElementById('toast');
const $busy = document.getElementById('busy');

const S = {
  me: null, nav: [], room: null, modal: null, tab: 'sheet',
  wiz: null, edit: null, cat: { q: '', group: 'all', rarity: 'all' }, log: null, logAll: false, bootError: null,
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
const SRC_LABEL = { race: 'Раса', class: 'Клас', subclass: 'Підклас', choice: 'Вибір', feat: 'Риса', custom: 'Від майстра' };
const moneyStr = (m) => R.COINS.filter((k) => m && m[k]).map((k) => `${m[k]} ${R.COIN_NAMES[k]}`).join(', ') || '0';

let toastTimer = null;
function toast(msg, err = false) {
  $toast.textContent = msg;
  $toast.className = 'show' + (err ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $toast.className = err ? 'err' : ''; }, err ? 4200 : 2400);
}
function confirmBox(msg) {
  return new Promise((res) => {
    if (tg && tg.showConfirm && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) tg.showConfirm(msg, (ok) => res(!!ok));
    else res(window.confirm(msg));
  });
}
let busyN = 0;
function busy(on) { busyN += on ? 1 : -1; $busy.hidden = busyN <= 0; }

async function api(op, params = {}) {
  if (!API || API.includes('REPLACE')) throw new Error('Сервер ще не налаштований (config.js).');
  let r;
  try {
    r = await fetch(`${API}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Init-Data': (tg && tg.initData) || '' },
      body: JSON.stringify({ op, ...params }),
    });
  } catch (e) {
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
function go(view, params = {}) { S.nav.push({ view, ...params }); S.modal = null; render(); window.scrollTo(0, 0); }
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
function closeModal() { S.modal = null; renderModal(); syncBackButton(); }

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
    const d = await api('room', { roomId });
    const changed = JSON.stringify(d) !== JSON.stringify(S.room);
    S.room = d;
    if (!silent || changed) { render(); if (S.modal) renderModal(); }
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

function openRoom(roomId) {
  S.roomId = roomId;
  if (!S.room || S.room.room.id !== roomId) S.room = null;
  S.tab = 'sheet';
  go('room', { roomId });
  loadRoom();
}

const isMaster = () => S.room && S.room.role === 'master';
function currentChar() {
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
function render() {
  const v = cur();
  const fn = VIEWS[v.view] || VIEWS.loading;
  $app.innerHTML = fn(v);
  syncBackButton();
}
function renderModal() {
  if (!S.modal) { $modal.innerHTML = ''; return; }
  const fn = MODALS[S.modal.type];
  const html = fn ? fn(S.modal) : '';
  if (html === null) { S.modal = null; $modal.innerHTML = ''; syncBackButton(); return; }
  const prev = $modal.querySelector('.sheet');
  const scroll = prev ? prev.scrollTop : 0;
  $modal.innerHTML = `<div class="overlay"><div class="sheet"><div class="grab"></div>${html}</div></div>`;
  const sh = $modal.querySelector('.sheet');
  if (sh) sh.scrollTop = scroll;
}
const loadingHtml = () => '<div class="center-screen"><div class="spinner"></div></div>';
const empty = (e, t) => `<div class="empty"><span class="e">${e}</span>${t}</div>`;
const hpClass = (s) => { const p = s.hp.max ? s.hp.cur / s.hp.max : 0; return p <= 0.25 ? 'low' : p <= 0.5 ? 'mid' : ''; };
const hdr = (title, sub) => `<div class="hdr"><div><h3>${title}</h3>${sub ? `<small>${sub}</small>` : ''}</div><button class="x" data-act="closeModal">✕</button></div>`;

const VIEWS = {
  loading: loadingHtml,

  noTelegram: () => `<div class="center-screen"><div style="font-size:64px">🐉</div><h2>DnD Companion</h2>
    <p class="hint">Цей застосунок працює всередині Telegram. Відкрий бота й натисни «🎲 Грати».</p>
    <a class="btn primary" href="https://t.me/${esc(CFG.BOT_USERNAME || '')}">Відкрити @${esc(CFG.BOT_USERNAME || 'бота')}</a></div>`,

  error: () => `<div class="center-screen"><div style="font-size:54px">🧌</div><h3>Щось пішло не так</h3>
    <p class="hint">${esc(S.bootError || '')}</p><button class="btn primary" data-act="retry">Спробувати ще</button></div>`,

  role: () => {
    const u = S.me.user;
    return `<div class="hero"><div class="logo">🐉</div><h1>DnD Companion</h1><p class="hint">Привіт, ${esc(u.name)}! Обери, ким ти будеш.</p></div>
    <div class="role-cards">
      <button class="role-card ${u.role === 'master' ? 'active' : ''}" data-act="pickRole" data-role="master"><span class="ic">🧙</span>
        <span><b>Майстер</b><small>Створюй кімнати, видавай предмети, керуй персонажами гравців</small></span></button>
      <button class="role-card ${u.role === 'player' ? 'active' : ''}" data-act="pickRole" data-role="player"><span class="ic">⚔️</span>
        <span><b>Гравець</b><small>Приєднуйся до кімнати й веди свого персонажа</small></span></button>
    </div>`;
  },

  masterHome: () => {
    const rooms = S.me.masterRooms;
    return `<div class="top"><h2>🧙 Майстер</h2><button class="link" data-act="switchRole">Змінити роль</button></div>
    <div class="card"><h3>Створити кімнату</h3>
      <p class="hint">Кімната — це твоя гра або кампанія. До ${S.me.maxPlayers} гравців.</p>
      <div class="row mt"><input id="newRoomName" class="grow" maxlength="60" placeholder="Назва, напр. «Копальні Фанделвера»">
      <button class="btn primary" data-act="createRoom">Створити</button></div></div>
    <h3 class="sec">Мої кімнати</h3>
    ${rooms.length ? rooms.map((r) => `<div class="card tap list-item" data-act="openRoom" data-id="${esc(r.id)}">
      <div class="ava">🏰</div><div class="meta"><b>${esc(r.name)}</b><small>Код ${esc(r.id)} · гравців ${r.players}/${S.me.maxPlayers} · сесія ${r.session}</small></div><span class="chev">›</span></div>`).join('')
    : empty('🏰', 'Ще немає кімнат. Створи першу вище.')}`;
  },

  playerHome: () => {
    const rooms = S.me.playerRooms;
    return `<div class="top"><h2>⚔️ Гравець</h2><button class="link" data-act="switchRole">Змінити роль</button></div>
    <div class="card"><h3>Приєднатися до кімнати</h3>
      <p class="hint">Введи код, який дав майстер, або відкрий його посилання-запрошення.</p>
      <div class="row mt"><input id="joinCode" class="grow code" style="font-size:18px" maxlength="10" placeholder="КОД" autocapitalize="characters">
      <button class="btn primary" data-act="joinByCode">Увійти</button></div></div>
    <h3 class="sec">Мої кімнати</h3>
    ${rooms.length ? rooms.map((r) => `<div class="card tap list-item" data-act="openRoom" data-id="${esc(r.id)}">
      <div class="ava">${r.character ? (CLASS_ICON[r.character.classId] || '🧝') : '🎲'}</div>
      <div class="meta"><b>${esc(r.name)}</b><small>${r.character ? `${esc(r.character.name)} · ${esc(R.CLASSES[r.character.classId] ? R.CLASSES[r.character.classId].name : '')} ${r.character.level} рів.` : 'Персонаж не створений'} · майстер ${esc(r.masterName || '')}</small>
      ${r.character && r.character.pendingLevel ? '<span class="badge gold">⬆️ новий рівень</span>' : ''}</div><span class="chev">›</span></div>`).join('')
    : empty('🗝️', 'Ти ще не в жодній кімнаті.')}`;
  },

  join: (v) => `<div class="center-screen"><div style="font-size:60px">📜</div><h2>Запрошення до гри</h2>
    <p class="hint">Код кімнати</p><div class="code">${esc(v.code)}</div>
    <button class="btn primary block mt" data-act="joinInvite" data-code="${esc(v.code)}">⚔️ Приєднатися як гравець</button>
    <button class="btn block" data-act="switchRole">Скасувати</button></div>`,

  room: () => {
    const d = S.room;
    if (!d) return loadingHtml();
    if (d.role === 'master') return masterRoomHtml(d);
    if (!d.character) return playerNoCharHtml(d);
    return charHtml(d.character, false);
  },

  char: () => {
    const ch = currentChar();
    if (!S.room) return loadingHtml();
    if (!ch) return empty('❔', 'Персонажа не знайдено. Можливо, він загинув або гравця видалено.');
    return charHtml(ch, true);
  },

  create: () => createHtml(),
  catalog: () => catalogHtml(),
  editSheet: () => editSheetHtml(),
  log: () => logHtml(),
};

// ---------- Кімната майстра ----------
function masterRoomHtml(d) {
  const r = d.room;
  const players = d.players;
  return `<div class="top"><h2>${esc(r.name)}</h2><button class="link" data-act="roomSettings">⚙️ Налаштування</button></div>
  <div class="card"><div class="row"><div class="grow"><small>Код кімнати</small><div class="code">${esc(r.id)}</div></div>
    <button class="btn primary" data-act="invite">📨 Запросити</button></div>
    <small class="hint">Сесія ${r.session} · гравців ${players.length}/${d.maxPlayers}</small></div>
  <div class="btns"><button class="btn" data-act="openLog">📜 Журнал</button><button class="btn" data-act="endSession">🏁 Завершити сесію</button></div>
  <div class="btns"><button class="btn sm" data-act="restAll" data-kind="short">☕ Короткий відпочинок для всіх</button><button class="btn sm" data-act="restAll" data-kind="long">🌙 Довгий для всіх</button></div>
  <h3 class="sec">Гравці</h3>
  ${players.length ? players.map(playerCard).join('') : empty('🕯️', 'Поки нікого. Надішли гравцям запрошення.')}
  ${d.fallen.length ? `<details class="mt"><summary>☠ Загиблі персонажі (${d.fallen.length})</summary>
    ${d.fallen.map((f) => `<div class="card list-item"><div class="ava">💀</div><div class="meta"><b>${esc(f.name)}</b>
    <small>${esc(R.CLASSES[f.classId] ? R.CLASSES[f.classId].name : '')} ${f.level} рів.</small></div>
    <button class="btn sm" data-act="revive" data-id="${f.id}">✨ Воскресити</button></div>`).join('')}</details>` : ''}`;
}
function playerCard(p) {
  const ch = p.character;
  if (!ch) {
    return `<div class="card list-item"><div class="ava">⏳</div><div class="meta"><b>${esc(p.name)}</b><small>ще не створив персонажа</small></div>
    <button class="btn sm danger" data-act="kick" data-uid="${p.userId}" data-name="${esc(p.name)}">Видалити</button></div>`;
  }
  const s = ch.sheet;
  const dv = derived(ch);
  return `<div class="card tap" data-act="openChar" data-id="${ch.id}"><div class="list-item">
    <div class="ava">${CLASS_ICON[s.classId] || '🧝'}</div>
    <div class="meta"><b>${esc(s.name)}</b><small>${esc(raceName(s))} · ${esc(className(s))} ${s.level} рів. · ${esc(p.name)}</small></div>
    <div class="center"><small>КЗ</small><div><b>${dv.ac}</b></div></div><span class="chev">›</span></div>
    <div class="row mt" style="margin-top:8px"><small class="grow">ХП ${s.hp.cur}/${s.hp.max}${s.hp.temp ? ` (+${s.hp.temp})` : ''}</small>
    ${s.targetLevel > s.level ? `<span class="badge gold">⬆️ очікує ${s.targetLevel} рів.</span>` : ''}${R.shortRestActive(s, nowSec()) ? ' <span class="badge green">☕</span>' : ''}${s.inspiration ? '<span class="badge gold">⭐</span>' : ''}</div>
    <div class="hpbar"><i class="${hpClass(s)}" style="width:${Math.max(0, Math.min(100, (s.hp.cur / s.hp.max) * 100))}%"></i></div></div>`;
}
function playerNoCharHtml(d) {
  return `<div class="top"><h2>${esc(d.room.name)}</h2><button class="link" data-act="roomMenu">⋯</button></div>
  <div class="card center"><div style="font-size:52px">🎲</div><h3>Створи персонажа</h3>
    <p class="hint">Майстер: ${esc(d.room.masterName)}. Пройди кроки за правилами D&D 5e: раса, клас, характеристики, навички.</p>
    <button class="btn primary block mt" data-act="startCreate">Створити персонажа</button></div>
  ${d.fallen.length ? `<h3 class="sec">☠ Загиблі персонажі</h3>${d.fallen.map((f) => `<div class="card list-item muted"><div class="ava">💀</div><div class="meta"><b>${esc(f.name)}</b>
  <small>${esc(R.CLASSES[f.classId] ? R.CLASSES[f.classId].name : '')} ${f.level} рів.</small></div></div>`).join('')}` : ''}`;
}

// ---------- Лист персонажа ----------
function charHtml(ch, M) {
  const s = ch.sheet;
  const dv = derived(ch);
  const next = s.level < 20 ? R.XP_TABLE[s.level] : null;
  const prev = R.XP_TABLE[s.level - 1] || 0;
  const pct = next ? Math.max(0, Math.min(100, ((s.xp - prev) / (next - prev)) * 100)) : 100;
  let h = M
    ? `<div class="top"><small class="hint">Гравець: ${esc(charOwnerName(ch))}</small></div>`
    : `<div class="top"><small class="hint">🏰 ${esc(S.room.room.name)}</small><button class="link" data-act="roomMenu">⋯</button></div>`;
  h += `<div class="char-head"><div class="nm">${CLASS_ICON[s.classId] || ''} ${esc(s.name)}${s.inspiration ? ' <span title="Натхнення">⭐</span>' : ''}</div>
    <div class="sub">${esc(raceName(s))} · ${esc(className(s))}${s.subclass ? ` (${esc(s.subclass)})` : ''} · ${s.level} рівень</div>
    <div class="xp"><div class="bar"><i style="width:${pct}%"></i></div><small>Досвід: ${s.xp}${next ? ` / ${next}` : ''}</small></div></div>
  <div class="stats">
    <div class="stat"><small>КЗ</small><b>${dv.ac}</b></div>
    <div class="stat tapable" data-act="hpModal"><small>Хіти</small><b>${s.hp.cur}/${s.hp.max}</b>${s.hp.temp ? `<span class="tmp">+${s.hp.temp} тимч.</span>` : ''}</div>
    <div class="stat"><small>Ініціат.</small><b>${fm(dv.init)}</b></div>
    <div class="stat"><small>Швидк.</small><b>${s.speed}</b></div>
    <div class="stat"><small>Майст.</small><b>${fm(dv.prof)}</b></div></div>
  <div class="hpbar"><i class="${hpClass(s)}" style="width:${Math.max(0, Math.min(100, (s.hp.cur / s.hp.max) * 100))}%"></i></div>`;
  if (s.targetLevel > s.level) {
    h += M ? `<div class="card"><span class="badge gold">⬆️ Гравцю доступне підвищення до ${s.targetLevel} рівня</span></div>`
      : `<button class="banner" data-act="openLevelUp">⬆️ Доступне підвищення до ${s.level + 1} рівня!<small>Натисни, щоб пройти підвищення за правилами 5e</small></button>`;
  }
  if (R.shortRestActive(s, nowSec())) {
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
  const tabs = [['sheet', 'Лист'], ['spells', 'Вміння'], ['info', 'Інфо'], ['inv', 'Інвентар']];
  h += `<div class="tabs">${tabs.map(([k, t]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${t}</button>`).join('')}</div>`;
  if (S.tab === 'spells') h += spellsTab(ch, dv, M);
  else if (S.tab === 'info') h += infoTab(ch);
  else if (S.tab === 'inv') h += invTab(ch, M);
  else h += sheetTab(ch, dv);
  return h;
}

function sheetTab(ch, dv) {
  const s = ch.sheet;
  let h = `<div class="abil mt">${R.ABILITIES.map((a) => `<div class="box"><small>${R.ABILITY_SHORT[a]}</small>
    <div class="m">${fm(R.mod(s.abilities[a]))}</div><span class="s">${s.abilities[a]}</span></div>`).join('')}</div>`;
  h += `<div class="lines"><h3>Рятівні кидки</h3>${R.ABILITIES.map((a) => `<div class="ln"><span class="dot ${s.saves.includes(a) ? 'p' : ''}"></span>
    <span>${R.ABILITY_NAMES[a]}</span><span class="v">${fm(R.saveValue(s, a))}</span></div>`).join('')}</div>`;
  h += `<div class="lines"><h3>Навички</h3>${R.SKILL_IDS.map((k) => {
    const p = s.skills[k] || 0;
    return `<div class="ln"><span class="dot ${p === 2 ? 'e' : p === 1 ? 'p' : ''}"></span><span>${R.SKILLS[k][0]} <span class="ab">${R.ABILITY_SHORT[R.SKILLS[k][1]]}</span></span>
    <span class="v">${fm(R.skillValue(s, k))}</span></div>`;
  }).join('')}<div class="ln"><span class="hint">● володіння · ◆ експертиза</span></div></div>`;
  const cls = R.CLASSES[s.classId];
  h += `<div class="lines"><h3>Бій</h3>
    <div class="ln"><span>Пасивна уважність</span><span class="v">${dv.pp}</span></div>
    <div class="ln"><span>Кості хітів</span><span class="v">${s.level - s.hitDiceUsed}/${s.level} × к${cls ? cls.hd : '?'}</span></div>
    <div class="ln"><span>Рятівні від смерті</span><span class="v">✅ ${s.deathSaves.s}/3 · ❌ ${s.deathSaves.f}/3</span></div>
    <div class="ln"><span>Натхнення</span><span class="v">${s.inspiration ? '⭐ є' : '—'}</span></div></div>`;
  const weapons = (ch.items || []).map((it) => ({ it, d: withBase(it.data) }))
    .filter(({ d }) => d.type === 'weapon' || (['staff', 'rod'].includes(d.type) && d.damage))
    .sort((a, b) => Number(b.it.equipped) - Number(a.it.equipped));
  h += `<div class="lines"><h3>Атаки</h3>${weapons.length ? weapons.map(({ it, d }) => {
    const w = R.weaponAttack(s, d);
    return `<div class="ln rc-${esc(d.rarity)}" data-act="itemModal" data-id="${it.id}" style="cursor:pointer"><span class="grow"><span class="rname">${esc(d.name)}</span>${it.equipped ? ' <span class="badge">в руках</span>' : ''}
    ${d.damage2 ? `<br><small>${esc(d.damage2)}</small>` : ''}</span><span class="v">${fm(w.hit)} · ${d.damage ? esc(w.dmg) : 'шкода не вказана'}</span></div>`;
  }).join('') : '<div class="ln hint">Немає зброї в інвентарі</div>'}</div>`;
  h += textSection(s, 'proficiencies');
  return h;
}

function textSection(s, key, title) {
  const t = s.text[key] || '';
  return `<div class="lines"><div class="row"><h3 class="grow">${title || R.TEXT_FIELDS[key]}</h3><button class="link" data-act="editText" data-fields="${key}">Змінити</button></div>
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
        return `<div class="ln"><span class="grow">${esc(r.name)} <span class="hint">${icon}</span></span><span class="v">${r.max - r.used}/${r.max}</span>
        <button class="btn sm" data-act="poolModal" data-id="${r.id}">${M ? 'Змінити' : 'Витратити'}</button></div>`;
      }
      return `<div class="ln"><span style="min-width:120px">${esc(r.name)} <span class="hint">${icon}</span></span>
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
  const list = s.spell.spells || [];
  for (let lvl = 0; lvl <= 9; lvl++) {
    const sp = list.filter((x) => x.level === lvl);
    if (!sp.length) continue;
    h += `<div class="lines"><h3>${lvl === 0 ? 'Замовляння' : `${lvl} коло`}</h3>${sp.map((x) => `<div class="ln">
      ${lvl ? `<button class="dot ${x.prepared ? 'p' : ''}" data-act="togglePrep" data-id="${esc(x.id)}" title="Підготовлено"></button>` : '<span class="dot p"></span>'}
      <span class="grow" data-act="spellModal" data-id="${esc(x.id)}" style="cursor:pointer"><b>${esc(x.name)}</b>${x.conc ? ' <span class="badge">К</span>' : ''}${x.ritual ? ' <span class="badge">Р</span>' : ''}
      <br><small>${esc([x.school, x.time, x.range].filter(Boolean).join(' · '))}</small></span></div>`).join('')}</div>`;
  }
  h += `<div class="btns"><button class="btn" data-act="spellForm">＋ ${caster ? 'Закляття' : 'Закляття (расове чи від предмета)'}</button></div>`;
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
      if (part.length) h += `<div class="spell-lvl">${SRC_LABEL[src]}</div>${featureListHtml(part, { showLvl: src !== 'race', del: M })}`;
    }
  }
  h += '</div>';
  h += textSection(s, 'features', 'Нотатки до вмінь');
  return h;
}

function infoTab(ch) {
  const s = ch.sheet;
  const phys = ['age', 'height', 'weight', 'eyes', 'skin', 'hair'];
  let h = `<div class="lines"><div class="row"><h3 class="grow">Про персонажа</h3><button class="link" data-act="editText" data-fields="info">Змінити</button></div>
    <div class="ln"><span>Передісторія</span><span class="v">${esc(bgName(s))}</span></div>
    <div class="ln"><span>Світогляд</span><span class="v">${esc(s.alignment || '—')}</span></div>
    ${phys.map((k) => `<div class="ln"><span>${R.TEXT_FIELDS[k]}</span><span class="v">${esc(s.text[k] || '—')}</span></div>`).join('')}</div>`;
  for (const k of ['personality', 'ideals', 'bonds', 'flaws', 'appearance', 'backstory', 'allies', 'treasure']) h += textSection(s, k);
  return h;
}

function invTab(ch, M) {
  const s = ch.sheet;
  const items = (ch.items || []).slice().sort((a, b) => Number(b.equipped) - Number(a.equipped) || a.data.name.localeCompare(b.data.name, 'uk'));
  const weight = items.reduce((t, it) => t + num(it.data.weight) * it.qty, 0);
  const cap = s.abilities.str * 15;
  const attuned = items.filter((it) => it.attuned).length;
  let h = `<div class="card"><div class="row"><h3 class="grow">💰 Гроші</h3>${M ? '<button class="link" data-act="moneyModal" data-mode="set">Змінити</button>' : ''}</div>
    <div class="money mt">${R.COINS.map((k) => `<div class="coin ${k}"><small>${R.COIN_NAMES[k]}</small><b>${s.money[k] || 0}</b></div>`).join('')}</div>
    ${M ? '' : `<div class="btns"><button class="btn sm" data-act="moneyModal" data-mode="spend">Витратити</button>${S.room.mates.length ? '<button class="btn sm" data-act="moneyModal" data-mode="give">Передати</button>' : ''}</div>`}</div>
  <div class="row mt"><small class="grow">Вага: ${Math.round(weight * 10) / 10} / ${cap} фнт</small><small>Налаштовано: ${attuned}/3</small></div>`;
  if (M) h += `<div class="btns"><button class="btn primary" data-act="openCatalog">🎁 З каталогу</button><button class="btn" data-act="customItem">＋ Свій предмет</button></div>`;
  h += items.length ? items.map(itemRow).join('') : empty('🎒', M ? 'Інвентар порожній. Видай предмети з каталогу.' : 'Інвентар порожній. Предмети видає майстер.');
  return h;
}
function itemSub(d, it) {
  return [R.ITEM_TYPES[d.type], d.damage && `${d.damage} ${d.dmgType || ''}`.trim(), d.type === 'armor' && d.ac && `КЗ ${d.ac + num(d.bonus)}`,
    d.type === 'shield' && `+${num(d.ac, 2) + num(d.bonus)} КЗ`, d.bonus && d.type !== 'armor' && d.type !== 'shield' && `+${d.bonus}`,
    it && it.equipped && 'екіпіровано', it && it.attuned && 'налаштовано'].filter(Boolean).join(' · ');
}
function itemRow(it) {
  const d = it.data;
  return `<div class="item rc-${esc(d.rarity)}" data-act="itemModal" data-id="${it.id}"><span class="ic">${ITEM_ICON[d.type] || '📦'}</span>
  <div class="meta"><div class="nm">${esc(d.name)}</div><small>${esc(itemSub(d, it))}</small></div><span class="q">×${it.qty}</span></div>`;
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
    const opts = R.choiceOptions(spec, optSheet, level);
    const sel = picks[spec.id] || [];
    return `<div class="card"><h3>${esc(spec.name)}</h3><p class="hint">Обери ${spec.need} (${sel.length}/${spec.need})</p>
    ${opts.map((op) => {
      const on = sel.includes(op.id);
      const dis = op.disabled || (!on && sel.length >= spec.need && spec.need > 1);
      return `<div class="pick ${dis && !on ? 'disabled' : ''}" data-act="pickChoice" data-path="${path}" data-spec="${spec.id}" data-k="${op.id}" data-max="${spec.need}">
      <input type="${spec.need === 1 ? 'radio' : 'checkbox'}" ${on ? 'checked' : ''} tabindex="-1" style="pointer-events:none">
      <span class="grow"><b>${esc(op.name)}</b>${op.desc ? `<br><small>${esc(op.desc)}</small>` : ''}</span>${op.reason ? `<span class="v hint">${esc(op.reason)}</span>` : ''}</div>`;
    }).join('')}</div>`;
  }).join('');
}
function featureListHtml(list, opts = {}) {
  if (!list.length) return '';
  return list.map((x) => `<div class="ln" style="align-items:flex-start"><span class="grow"><b>${esc(x.name)}</b>
    ${opts.showLvl ? ` <span class="badge">${x.lvl} рів.</span>` : ''}${opts.showSrc ? ` <span class="badge">${SRC_LABEL[x.src] || ''}</span>` : ''}
    ${x.desc ? `<br><small>${esc(x.desc)}</small>` : ''}</span>${opts.del ? `<button class="x" data-act="delFeature" data-i="${x._i}">✕</button>` : ''}</div>`).join('');
}

// ---------- Створення персонажа ----------
function newWizard() {
  return {
    step: 1, name: '', raceId: '', classId: '', backgroundId: '', alignment: '',
    method: 'standard', assign: {}, pb: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    rolls: (S.room && S.room.lastRoll) || null, raceChoice: [], skills: [], raceSkills: [], bgSkills: [], expertise: [], text: {}, subclassId: '', choices: {},
  };
}
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
function wizInput() {
  const w = S.wiz;
  return {
    name: w.name, raceId: w.raceId, classId: w.classId, backgroundId: w.backgroundId, alignment: w.alignment,
    base: wizBase() || {}, raceChoice: w.raceChoice, skills: w.skills, raceSkills: w.raceSkills, bgSkills: w.bgSkills, expertise: w.expertise, text: w.text,
    subclassId: w.subclassId, choices: w.choices,
  };
}
function wizFixedSkills() {
  const w = S.wiz;
  const race = R.RACES[w.raceId] || {};
  const bg = R.BACKGROUNDS[w.backgroundId] || { skills: [] };
  return new Set([...(bg.choose ? w.bgSkills : bg.skills), ...(race.skills || [])]);
}
function wizStepError() {
  const w = S.wiz;
  if (w.step === 1) {
    if (!w.name.trim()) return 'Вкажи ім’я';
    if (!w.raceId || !w.classId || !w.backgroundId) return 'Обери расу, клас і передісторію';
  }
  if (w.step === 2) {
    if (!wizBase()) return w.method === 'roll' && !w.rolls ? 'Кинь кубики' : 'Розподіли всі значення';
    if (w.method === 'pointbuy' && pbSpent() > R.POINT_BUY_TOTAL) return 'Перевищено бюджет очок';
    const race = R.RACES[w.raceId];
    if (race.choose && w.raceChoice.length !== race.choose.count) return `Обери ${race.choose.count} характеристики для бонусу раси`;
  }
  if (w.step >= 3) {
    const { errors } = R.buildCharacter(wizInput());
    if (errors.length) return errors[0];
  }
  return null;
}
function createHtml() {
  const w = S.wiz;
  if (!w) return loadingHtml();
  const err = wizStepError();
  let h = `<div class="top"><h2>Новий персонаж</h2><small class="hint">Крок ${w.step}/4</small></div>
  <div class="steps">${[1, 2, 3, 4].map((i) => `<i class="${i <= w.step ? 'on' : ''}"></i>`).join('')}</div>`;
  if (w.step === 1) h += wizStep1();
  if (w.step === 2) h += wizStep2();
  if (w.step === 3) h += wizStep3();
  if (w.step === 4) h += wizStep4();
  h += `${err ? `<p class="hint center mt">⚠️ ${esc(err)}</p>` : ''}<div class="btns mt2">
    ${w.step > 1 ? '<button class="btn" data-act="wizStep" data-d="-1">← Назад</button>' : ''}
    ${w.step < 4 ? `<button class="btn primary ${err ? 'disabled' : ''}" data-act="wizStep" data-d="1">Далі →</button>`
    : `<button class="btn primary ${err ? 'disabled' : ''}" data-act="createChar">✅ Створити персонажа</button>`}</div>`;
  return h;
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
    ${race ? `<small class="hint">Бонуси: ${Object.entries(race.bonus).map(([a, v]) => `${R.ABILITY_SHORT[a]} +${v}`).join(', ')}${race.choose ? `, +1 до двох інших на вибір` : ''} · швидкість ${race.speed} фт${race.skills ? ` · ${race.skills.map((k) => R.SKILLS[k][0]).join(', ')}` : ''}${race.skillChoice ? ` · ${race.skillChoice} навички на вибір` : ''}</small>` : ''}
    <label class="fld"><span>Клас</span><select data-bind="wiz.classId" data-rerender>${opts(R.CLASSES, w.classId, 'Обери клас')}</select></label>
    ${cls ? `<small class="hint">Кість хітів к${cls.hd} · рятівні: ${cls.saves.map((a) => R.ABILITY_SHORT[a]).join(', ')} · навичок: ${cls.skillCount}${cls.caster !== 'none' ? ` · заклинач (${R.ABILITY_SHORT[cls.spellAbility]})` : ''}</small>` : ''}
    <label class="fld"><span>Передісторія</span><select data-bind="wiz.backgroundId" data-rerender>${opts(R.BACKGROUNDS, w.backgroundId, 'Обери передісторію')}</select></label>
    ${bg ? `<small class="hint">${bg.choose ? 'Обереш 2 навички самостійно' : `Навички: ${bg.skills.map((k) => R.SKILLS[k][0]).join(', ')}`}</small>` : ''}
    <label class="fld"><span>Світогляд</span><select data-bind="wiz.alignment"><option value="">—</option>${R.ALIGNMENTS.map((a) => `<option ${a === w.alignment ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
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
  return keys.map((k) => {
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
  const pre = R.buildCharacter({ ...wizInput(), choices: {} }).sheet;
  if (pre && !R.subclassNeeded(pre, 1)) {
    const specs = R.pendingChoices(pre, 1);
    if (specs.length) h += `<h3 class="sec">Вибори 1 рівня</h3>${choicesHtml(specs, pre, 1, 'wiz.choices', w.choices)}`;
  }
  return h;
}
function wizStep4() {
  const w = S.wiz;
  const { sheet } = R.buildCharacter(wizInput());
  let h = '';
  if (sheet) {
    const dv = { ac: R.computeAC(sheet, []), prof: R.sheetProf(sheet) };
    h += `<div class="char-head"><div class="nm">${CLASS_ICON[sheet.classId]} ${esc(sheet.name)}</div><div class="sub">${esc(raceName(sheet))} · ${esc(className(sheet))} · 1 рівень</div></div>
    <div class="stats"><div class="stat"><small>Хіти</small><b>${sheet.hp.max}</b></div><div class="stat"><small>КЗ</small><b>${dv.ac}</b></div>
    <div class="stat"><small>Ініціат.</small><b>${fm(R.mod(sheet.abilities.dex))}</b></div><div class="stat"><small>Швидк.</small><b>${sheet.speed}</b></div>
    <div class="stat"><small>Майст.</small><b>${fm(dv.prof)}</b></div></div>
    <div class="abil mt">${R.ABILITIES.map((a) => `<div class="box"><small>${R.ABILITY_SHORT[a]}</small><div class="m">${fm(R.mod(sheet.abilities[a]))}</div><span class="s">${sheet.abilities[a]}</span></div>`).join('')}</div>
    <div class="card"><small class="hint">Навички: ${Object.keys(sheet.skills).map((k) => R.SKILLS[k][0] + (sheet.skills[k] === 2 ? ' (експ.)' : '')).join(', ')}</small></div>
    <div class="lines"><h3>Вміння та риси</h3>${featureListHtml(sheet.features || [], { showSrc: true })}</div>`;
  }
  h += `<div class="card"><h3>Опис (можна заповнити пізніше)</h3>
    <label class="fld"><span>Зовнішність</span><textarea data-bind="wiz.text.appearance" maxlength="4000">${esc(w.text.appearance || '')}</textarea></label>
    <label class="fld"><span>Риси характеру</span><textarea data-bind="wiz.text.personality" maxlength="4000">${esc(w.text.personality || '')}</textarea></label>
    <label class="fld"><span>Передісторія персонажа</span><textarea data-bind="wiz.text.backstory" maxlength="4000">${esc(w.text.backstory || '')}</textarea></label>
    <label class="fld"><span>Володіння та мови</span><textarea data-bind="wiz.text.proficiencies" maxlength="4000" placeholder="Обладунки, зброя, інструменти, мови">${esc(w.text.proficiencies || '')}</textarea></label></div>`;
  return h;
}

// ---------- Каталог ----------
const CAT_GROUPS = [['all', 'Усі'], ['weapon', 'Зброя'], ['armor', 'Обладунки'], ['gear', 'Спорядження'], ['potion', 'Зілля'], ['magic', 'Магічні'], ['tool', 'Інструменти'], ['treasure', 'Скарби']];
function catalogFiltered() {
  const { q, group, rarity } = S.cat;
  const ql = q.trim().toLowerCase();
  return CATALOG.filter((it) => {
    if (rarity !== 'all' && it.rarity !== rarity) return false;
    if (group === 'weapon' && it.type !== 'weapon') return false;
    if (group === 'armor' && !['armor', 'shield'].includes(it.type)) return false;
    if (group === 'gear' && !['gear', 'ammo', 'food'].includes(it.type)) return false;
    if (group === 'potion' && it.type !== 'potion') return false;
    if (group === 'magic' && it.group !== 'Магічні предмети') return false;
    if (group === 'tool' && it.type !== 'tool') return false;
    if (group === 'treasure' && it.type !== 'treasure') return false;
    return !ql || it.name.toLowerCase().includes(ql) || (it.desc || '').toLowerCase().includes(ql);
  });
}
function catalogListHtml() {
  const list = catalogFiltered();
  if (!list.length) return empty('🔍', 'Нічого не знайдено');
  return list.map((it) => `<div class="item rc-${it.rarity}" data-act="catPick" data-id="${esc(it.catalogId)}"><span class="ic">${ITEM_ICON[it.type] || '📦'}</span>
    <div class="meta"><div class="nm">${esc(it.name)}</div><small>${esc([R.RARITIES[it.rarity].name, itemSub(it), it.cost, it.attune && 'налаштування'].filter(Boolean).join(' · '))}</small></div></div>`).join('');
}
function catalogHtml() {
  const ch = currentChar();
  return `<div class="top"><h2>🎁 Каталог D&D 5e</h2></div>
  <p class="hint" style="margin:4px">Видати предмет: <b>${ch ? esc(ch.sheet.name) : ''}</b></p>
  <input data-bind="cat.q" data-live="catalog" value="${esc(S.cat.q)}" placeholder="🔍 Пошук: меч, зілля, плащ…" class="mt">
  <div class="chips">${CAT_GROUPS.map(([k, t]) => `<button class="chip ${S.cat.group === k ? 'on' : ''}" data-act="catGroup" data-g="${k}">${t}</button>`).join('')}</div>
  <div class="chips"><button class="chip ${S.cat.rarity === 'all' ? 'on' : ''}" data-act="catRarity" data-r="all">Будь-яка рідкість</button>
  ${R.RARITY_IDS.map((k) => `<button class="chip rc-${k} ${S.cat.rarity === k ? 'on' : ''}" data-act="catRarity" data-r="${k}"><span class="rname">${R.RARITIES[k].name}</span></button>`).join('')}</div>
  <button class="btn block mt" data-act="customItem">＋ Створити свій предмет</button>
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
    <label class="fld"><span>Світогляд</span><select data-bind="edit.alignment"><option value="">—</option>${R.ALIGNMENTS.map((a) => `<option ${a === e.alignment ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
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
    <label class="row fld" style="margin-top:28px"><input type="checkbox" data-bind="edit.inspiration" ${e.inspiration ? 'checked' : ''}><span>Натхнення ⭐</span></label></div></div>
  <div class="card"><h3>Закляття</h3>
    <label class="fld"><span>Заклинальна характеристика</span><select data-bind="edit.spell.ability"><option value="">Авто (за класом)</option>${R.ABILITIES.map((a) => `<option value="${a}" ${e.spell.ability === a ? 'selected' : ''}>${R.ABILITY_NAMES[a]}</option>`).join('')}</select></label>
    <label class="row fld"><input type="checkbox" data-act="toggleSlotsOverride" ${Array.isArray(e.spell.slotsOverride) ? 'checked' : ''}><span>Задати комірки вручну (авто: ${auto.join('/') || 'немає'})</span></label>
    ${Array.isArray(e.spell.slotsOverride) ? `<div class="grid3">${Array.from({ length: 9 }, (_, i) => `<label class="fld"><span>${i + 1} коло</span>${numIn(`edit.spell.slotsOverride.${i}`, e.spell.slotsOverride[i] || 0)}</label>`).join('')}</div>` : ''}</div>
  <button class="btn primary block mt2" data-act="saveSheetEdit">💾 Зберегти зміни</button>`;
}

// ---------- Журнал ----------
function logHtml() {
  const L = S.log;
  const fmt = (ts) => new Date(ts * 1000).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `<div class="top"><h2>📜 Журнал</h2></div>
  <div class="chips"><button class="chip ${!S.logAll ? 'on' : ''}" data-act="logToggle" data-all="0">Поточна сесія</button><button class="chip ${S.logAll ? 'on' : ''}" data-act="logToggle" data-all="1">Увесь журнал</button></div>
  <div class="btns"><button class="btn" data-act="exportLog">📥 Надіслати .txt у чат</button><button class="btn" data-act="endSession">🏁 Завершити сесію</button></div>
  <div class="card">${!L ? '<div class="spinner" style="margin:20px auto"></div>' : L.entries.length ? L.entries.map((e) => `<div class="log-e"><small>${fmt(e.ts)}${S.logAll ? ` · сесія ${e.session}` : ''} · ${esc(e.actor)}</small>${esc(e.text)}</div>`).join('') : empty('📜', 'Записів поки немає')}</div>`;
}

// ================= Модальні вікна =================
const MODALS = {
  invite: () => {
    const r = S.room.room;
    const link = inviteLink(r.id);
    return `${hdr('📨 Запросити гравців')}<p class="hint">Надішли посилання гравцям — воно відкриє бота з кнопкою входу в кімнату. Або скажи код.</p>
    <div class="card center"><small>Код кімнати</small><div class="code" style="font-size:30px">${esc(r.id)}</div><small style="word-break:break-all">${esc(link)}</small></div>
    <div class="btns"><button class="btn primary" data-act="shareInvite">Поділитися в Telegram</button><button class="btn" data-act="copy" data-text="${esc(link)}">Копіювати</button></div>`;
  },

  roomSettings: (m) => `${hdr('⚙️ Налаштування кімнати')}
    <label class="fld"><span>Назва</span><input data-bind="modal.name" value="${esc(m.name)}" maxlength="60"></label>
    <button class="btn primary block mt" data-act="renameRoom">Зберегти назву</button>
    <button class="btn danger block mt2" data-act="deleteRoom">🗑 Видалити кімнату</button>`,

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
    <div class="ln"><span class="grow">⭐ Натхнення: ${s.inspiration ? 'є' : 'немає'}</span>${M ? `<button class="btn sm" data-act="inspiration">${s.inspiration ? 'Забрати' : 'Дати'}</button>` : s.inspiration ? '<button class="btn sm" data-act="inspiration">Використати</button>' : ''}</div>
    ${M ? `<div class="btns"><button class="btn" data-act="rest" data-kind="short">☕ Короткий відпочинок</button><button class="btn" data-act="rest" data-kind="long">🌙 Довгий відпочинок</button></div>`
      : '<p class="hint mt">Зміни хітів бачить майстер у журналі. Відпочинок оголошує майстер.</p>'}`;
  },

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
    const rows = [['Рідкість', `<span class="rname">${R.RARITIES[d.rarity].name}</span>`], ['Тип', R.ITEM_TYPES[d.type]], ['Ціна', esc(d.cost)], ['Вага', d.weight != null ? `${d.weight} фнт` : ''],
      ['Шкода', esc([d.damage, d.dmgType].filter(Boolean).join(' '))], ['Дод. шкода', esc(d.damage2)], ['Властивості', esc(d.props)], ['Магічний бонус', d.bonus ? `+${d.bonus}` : ''],
      ['КЗ', d.ac != null && d.ac !== '' ? (d.type === 'shield' ? `+${d.ac}` : `${d.ac}${d.dexMax == null ? ' + СПР' : d.dexMax ? ` + СПР (макс. ${d.dexMax})` : ''}`) : ''],
      ['Бонус до КЗ', d.acBonus ? `+${d.acBonus}` : ''], ['Потрібна Сила', d.strReq || ''], ['Непомітність', d.stealthDis ? 'перешкода' : ''], ['Налаштування', esc(d.attune)], ['Заряди', esc(d.charges)]]
      .filter(([, v]) => v !== '' && v != null);
    const wd = withBase(d);
    if (wd.type === 'weapon' || (['staff', 'rod'].includes(wd.type) && wd.damage)) { const w = R.weaponAttack(ch.sheet, wd); rows.push(['Атака', `${fm(w.hit)} · ${wd.damage ? esc(w.dmg) : 'шкода не вказана'}`]); }
    const cons = R.isConsumable(d);
    rows.push(['Витратний', cons ? 'так' : 'ні']);
    const equipable = ['weapon', 'armor', 'shield', 'ring', 'wondrous', 'staff', 'rod', 'wand'].includes(d.type);
    let h = `<div class="rc-${esc(d.rarity)}">${hdr(`<span class="rname">${ITEM_ICON[d.type] || ''} ${esc(d.name)}</span>`, `Кількість: ${it.qty}${it.equipped ? ' · екіпіровано' : ''}${it.attuned ? ' · налаштовано' : ''}`)}
      <dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      ${d.desc ? `<div class="textblock mt">${esc(d.desc)}</div>` : ''}</div>`;
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
    const title = m.mode === 'edit' ? '✏️ Редагувати предмет' : m.mode === 'custom' ? '＋ Свій предмет' : '🎁 Видати предмет';
    return `${hdr(title, ch ? `Персонаж: ${esc(ch.sheet.name)}` : '')}
    <div class="card rc-${esc(f.rarity)} center"><span class="rname" style="font-size:18px">${ITEM_ICON[f.type] || ''} ${esc(f.name || 'Без назви')}</span><br><small>${R.RARITIES[f.rarity].name}</small></div>
    ${f.desc && m.mode === 'issue' ? `<div class="textblock mt">${esc(f.desc)}</div>` : ''}
    ${m.mode !== 'edit' ? `<div class="card"><label class="fld" style="margin:0"><span>Кількість</span><div class="stepper"><button data-act="qtyStep" data-d="-1">−</button>
      <input type="number" data-bind="modal.qty" value="${m.qty}" min="1"><button data-act="qtyStep" data-d="1">+</button></div></label>
      <button class="btn primary block mt" data-act="saveItemForm">Видати ${ch ? esc(ch.sheet.name) : ''}</button></div>` : ''}
    <details ${m.mode !== 'issue' ? 'open' : ''}><summary>Властивості предмета${m.mode === 'issue' ? ' (можна змінити перед видачею)' : ''}</summary>
    <label class="fld"><span>Назва</span><input data-bind="modal.form.name" value="${esc(f.name)}" maxlength="80"></label>
    <div class="grid2"><label class="fld"><span>Рідкість</span><select data-bind="modal.form.rarity" data-rerender="modal">${R.RARITY_IDS.map((k) => `<option value="${k}" ${f.rarity === k ? 'selected' : ''}>${R.RARITIES[k].name}</option>`).join('')}</select></label>
    <label class="fld"><span>Тип</span><select data-bind="modal.form.type" data-rerender="modal">${Object.entries(R.ITEM_TYPES).map(([k, v]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
    <div class="grid3"><label class="fld"><span>Ціна</span><input data-bind="modal.form.cost" value="${esc(f.cost || '')}" placeholder="10 ЗМ"></label>
    <label class="fld"><span>Вага, фнт</span><input type="number" step="0.25" data-bind="modal.form.weight" value="${esc(f.weight ?? '')}"></label>
    <label class="fld"><span>Магічний +</span><input type="number" data-bind="modal.form.bonus" value="${esc(f.bonus || '')}" placeholder="0"></label></div>
    <label class="row fld"><input type="checkbox" data-bind="modal.form.consumable" ${R.isConsumable(f) ? 'checked' : ''}><span>Витратний предмет (гравець може використовувати й зменшувати кількість)</span></label>
    ${f.type === 'weapon' ? `<label class="fld"><span>Базова зброя (заповнить шкоду й властивості)</span><select data-onchange="applyBaseWeapon"><option value="">—</option>
      ${BASE_WEAPONS.map((w) => `<option value="${w.id}" ${f.baseName === w.name ? 'selected' : ''}>${esc(w.name)} — ${esc(w.damage || '—')} ${esc(w.dmgType || '')}</option>`).join('')}</select></label>` : ''}
    ${showWeapon ? `<div class="grid2"><label class="fld"><span>Шкода</span><input data-bind="modal.form.damage" value="${esc(f.damage || '')}" placeholder="1к8"></label>
      <label class="fld"><span>Тип шкоди</span><select data-bind="modal.form.dmgType"><option value="">—</option>${R.DAMAGE_TYPES.map((t) => `<option ${f.dmgType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
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
    ${m.mode === 'edit' ? '<button class="btn primary block mt2" data-act="saveItemForm">💾 Зберегти</button>' : ''}`;
  },

  spell: (m) => {
    const ch = currentChar();
    const sp = ch && ch.sheet.spell.spells.find((x) => x.id === m.id);
    if (!sp) return null;
    const rows = [['Коло', sp.level ? `${sp.level}` : 'замовляння'], ['Школа', sp.school], ['Час створення', sp.time], ['Дистанція', sp.range], ['Компоненти', sp.comp],
      ['Тривалість', sp.dur], ['Концентрація', sp.conc ? 'так' : ''], ['Ритуал', sp.ritual ? 'так' : ''], ['Підготовлено', sp.level ? (sp.prepared ? 'так' : 'ні') : '']].filter(([, v]) => v);
    return `${hdr(`📖 ${esc(sp.name)}`)}<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    ${sp.desc ? `<div class="textblock mt">${esc(sp.desc)}</div>` : ''}
    <div class="btns"><button class="btn" data-act="spellForm" data-id="${esc(sp.id)}">✏️ Змінити</button><button class="btn danger" data-act="deleteSpell" data-id="${esc(sp.id)}">🗑 Видалити</button></div>`;
  },

  spellForm: (m) => {
    const f = m.form;
    return `${hdr(m.id ? '✏️ Закляття' : '＋ Нове закляття або вміння')}
    <label class="fld"><span>Назва</span><input data-bind="modal.form.name" value="${esc(f.name)}" maxlength="80" placeholder="Напр. Магічна стріла"></label>
    <div class="grid2"><label class="fld"><span>Коло</span><select data-bind="modal.form.level" data-num>${Array.from({ length: 10 }, (_, i) => `<option value="${i}" ${num(f.level) === i ? 'selected' : ''}>${i ? `${i} коло` : 'Замовляння'}</option>`).join('')}</select></label>
    <label class="fld"><span>Школа</span><select data-bind="modal.form.school"><option value="">—</option>${R.SPELL_SCHOOLS.map((x) => `<option ${f.school === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
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
    <div class="card"><h3>Хіти</h3><p class="hint">Кість хітів к${cls.hd}${conMod ? `, Статура ${fm(conMod)}` : ''}${hpBonus ? `, бонус +${hpBonus}` : ''}</p>
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
  toHome: () => { const home = isMaster() ? 'masterHome' : 'playerHome'; S.room = null; S.roomId = null; reset('role', home); loadMe(true); },

  createRoom: async () => {
    const el = document.getElementById('newRoomName');
    const name = el.value.trim();
    if (!name) { toast('Вкажи назву кімнати', true); el.focus(); return; }
    const r = await run(() => api('createRoom', { name }), 'Кімнату створено');
    if (r) { await loadMe(true); openRoom(r.room.id); }
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
  openChar: ({ id }) => { S.tab = 'sheet'; go('char', { charId: Number(id) }); },
  tab: ({ tab }) => { S.tab = tab; tapFx(); render(); },

  invite: () => openModal({ type: 'invite' }),
  shareInvite: () => {
    const r = S.room.room;
    const link = inviteLink(r.id);
    const text = `Приєднуйся до гри «${r.name}» у DnD Companion! Код кімнати: ${r.id}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank');
  },
  copy: async ({ text }) => {
    try { await navigator.clipboard.writeText(text); toast('Скопійовано'); } catch (e) { toast('Не вдалося скопіювати — виділи текст вручну', true); }
  },
  roomSettings: () => openModal({ type: 'roomSettings', name: S.room.room.name }),
  renameRoom: async () => {
    const ok = await run(() => api('renameRoom', { roomId: roomId(), name: S.modal.name }), 'Назву змінено');
    if (ok) { closeModal(); await loadRoom(true); }
  },
  deleteRoom: async () => {
    if (!(await confirmBox(`Видалити кімнату «${S.room.room.name}»? Гравці втратять до неї доступ.`))) return;
    const ok = await run(() => api('deleteRoom', { roomId: roomId() }), 'Кімнату видалено');
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
    if (!(await confirmBox(`Завершити сесію ${n}? Журнал сесії прийде тобі файлом .txt у чат із ботом, гравці отримають сповіщення.`))) return;
    const r = await run(() => api('endSession', { roomId: roomId() }));
    if (r) {
      toast(r.sent ? `🏁 Сесію ${n} завершено. Журнал надіслано в чат.` : `Сесію завершено, але файл не надіслано — натисни Start у чаті з ботом і надішли журнал повторно.`, !r.sent);
      await loadRoom(true);
      if (cur().view === 'log') { S.log = null; render(); loadLog(); }
    }
  },

  // --- Створення персонажа ---
  startCreate: () => { S.wiz = newWizard(); go('create'); },
  wizStep: ({ d }) => { S.wiz.step = Math.max(1, Math.min(4, S.wiz.step + Number(d))); render(); window.scrollTo(0, 0); },
  wizMethod: ({ m }) => { S.wiz.method = m; S.wiz.assign = {}; render(); },
  roll: async () => {
    if (S.wiz.rolls && !(await confirmBox('Перекинути кубики? Майстер побачить обидва кидки в журналі.'))) return;
    const r = await run(() => api('rollAbilities', { roomId: roomId() }));
    if (r) { S.wiz.rolls = r.rolls; S.wiz.assign = {}; render(); }
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
    const r = await run(() => api('createCharacter', { roomId: roomId(), method: w.method, input: wizInput() }), '🎉 Персонажа створено!');
    if (r) { S.wiz = null; S.nav.pop(); S.tab = 'sheet'; await loadRoom(); }
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
  inspiration: async () => {
    const ch = currentChar();
    await reloadAfter(() => updateTrackers(ch, { inspiration: !ch.sheet.inspiration }));
  },
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
  spellModal: ({ id }) => openModal({ type: 'spell', id }),
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
  openCatalog: () => { closeModal(); go('catalog', { charId: currentChar().id }); },
  catGroup: ({ g }) => { S.cat.group = g; render(); },
  catRarity: ({ r }) => { S.cat.rarity = r; render(); },
  catPick: ({ id }) => {
    const it = CATALOG.find((x) => x.catalogId === id);
    const form = clone(it);
    delete form.group;
    openModal({ type: 'itemForm', mode: 'issue', charId: cur().charId, form, qty: 1 });
  },
  customItem: () => openModal({ type: 'itemForm', mode: 'custom', charId: currentChar().id, form: itemFormBlank(), qty: 1 }),
  saveItemForm: async () => {
    const m = S.modal;
    if (!String(m.form.name || '').trim()) { toast('Вкажи назву предмета', true); return; }
    if (m.mode === 'edit') {
      const ok = await reloadAfter(() => api('masterEditItem', { itemId: m.itemId, item: m.form }), 'Предмет змінено');
      if (ok) closeModal();
      return;
    }
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
    Object.assign(S.modal.form, { damage: w.damage, dmgType: w.dmgType, props: w.props, ranged: w.ranged, weight: w.weight, baseName: w.name });
    renderModal();
  },
};

async function loadLog() {
  try {
    S.log = await api('logList', { roomId: roomId(), all: S.logAll });
    if (cur().view === 'log') render();
  } catch (e) { toast(e.message, true); }
}

// ================= Події =================
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('overlay')) { closeModal(); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
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
  if ('rerender' in el.dataset) { if (el.dataset.rerender === 'modal') renderModal(); else render(); }
});
function getArr(path) { return path.split('.').reduce((o, k) => o[k], S); }

// Автооновлення даних кімнати
setInterval(() => {
  const v = cur().view;
  if (!['room', 'char'].includes(v) || S.modal || document.hidden || busyN > 0) return;
  const a = document.activeElement;
  if (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)) return;
  loadRoom(true);
}, 12000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ['room', 'char'].includes(cur().view)) loadRoom(true);
});

// ================= Старт =================
async function boot() {
  if (!tg || !tg.initData) { reset('noTelegram'); return; }
  try {
    tg.ready();
    tg.expand();
    if (tg.BackButton) tg.BackButton.onClick(back);
    if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) { tg.setHeaderColor('secondary_bg_color'); tg.setBackgroundColor('secondary_bg_color'); }
    if (tg.isVersionAtLeast && tg.isVersionAtLeast('7.7') && tg.disableVerticalSwipes) tg.disableVerticalSwipes();
  } catch (e) { /* старі клієнти */ }
  reset('loading');
  try {
    S.me = await api('me');
  } catch (e) {
    S.bootError = e.message;
    reset('error');
    return;
  }
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
