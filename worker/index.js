// DnD Companion — сервер (Cloudflare Worker + D1)
// Маршрути: POST /api (Mini App), POST /bot (вебхук Telegram), GET /setup (налаштування бота)
import * as R from '../shared/rules.js';
import { MONSTERS, monInit, CR_XP } from '../shared/monsters.js';
import { CATALOG_BY_ID } from '../data/items.js';
import { compile, translate, normLang, langFromTg, LOCALES } from '../shared/i18n.js';
import RU from '../i18n/ru.js';
import EN from '../i18n/en.js';

// Переклад повідомлень бота й журналу мовою отримувача (тексти в коді — українською)
const DICTS = {};
function dictFor(lang) {
  lang = normLang(lang);
  if (lang === 'uk') return null;
  if (!DICTS[lang]) DICTS[lang] = compile(lang === 'ru' ? RU : EN, lang);
  return DICTS[lang];
}
const tr = (lang, s) => { const D = dictFor(lang); return D ? translate(D, s) : s; };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, first_name TEXT, username TEXT, role TEXT, created_at INTEGER, updated_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, master_id INTEGER NOT NULL, session INTEGER NOT NULL DEFAULT 1, created_at INTEGER, deleted INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_master ON rooms(master_id)`,
  `CREATE TABLE IF NOT EXISTS members (room_id TEXT NOT NULL, user_id INTEGER NOT NULL, joined_at INTEGER, last_roll TEXT, PRIMARY KEY (room_id, user_id))`,
  `CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id)`,
  `CREATE TABLE IF NOT EXISTS characters (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, user_id INTEGER NOT NULL, alive INTEGER NOT NULL DEFAULT 1, sheet TEXT NOT NULL, created_at INTEGER, updated_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_chars_room ON characters(room_id, alive)`,
  `CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, char_id INTEGER NOT NULL, data TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1, equipped INTEGER NOT NULL DEFAULT 0, attuned INTEGER NOT NULL DEFAULT 0, created_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_items_char ON items(char_id)`,
  `CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, session INTEGER NOT NULL, ts INTEGER NOT NULL, actor_id INTEGER, actor TEXT, text TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_room ON logs(room_id, session)`,
  `CREATE TABLE IF NOT EXISTS master_items (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, data TEXT NOT NULL, created_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_master_items_owner ON master_items(owner_id)`,
  // кидки кубиків гравців (історія на вкладці «Кидки»)
  `CREATE TABLE IF NOT EXISTS dice_rolls (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, char_id INTEGER NOT NULL, user_id INTEGER NOT NULL, ts INTEGER NOT NULL, data TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_dice_char ON dice_rolls(char_id, id)`,
  // події майстра (бій, дослідження…): усе, що сталося за час події, — окремим звітом
  `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, num INTEGER NOT NULL, session INTEGER NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_events_room ON events(room_id)`,
  `CREATE TABLE IF NOT EXISTS event_acts (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL, char_id INTEGER NOT NULL, ts INTEGER NOT NULL, kind TEXT NOT NULL, value INTEGER NOT NULL DEFAULT 1, data TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_event_acts ON event_acts(event_id)`,
  // учасники подій (історія: коли приєднався / вийшов); персонаж — щонайбільше в одній активній події
  `CREATE TABLE IF NOT EXISTS event_members (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL, char_id INTEGER NOT NULL, joined_at INTEGER NOT NULL, left_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_event_members ON event_members(event_id)`,
  `CREATE INDEX IF NOT EXISTS idx_event_members_char ON event_members(char_id)`,
  // стан персонажа на початку сесії (рівень, досвід, гроші, предмети…) — для підсумку сесії
  `CREATE TABLE IF NOT EXISTS char_snaps (char_id INTEGER NOT NULL, session INTEGER NOT NULL, room_id TEXT NOT NULL, ts INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (char_id, session))`,
  `CREATE INDEX IF NOT EXISTS idx_char_snaps_room ON char_snaps(room_id, session)`,
  // стислий підсумок завершеної сесії (детальний журнал після завершення видаляється)
  `CREATE TABLE IF NOT EXISTS session_summaries (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, session INTEGER NOT NULL, ts INTEGER NOT NULL, data TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_session_summaries ON session_summaries(room_id, session)`,
  // ефекти (стани) на персонажах: key — стандартний ефект із правил, data — назва/значок (+опис для своїх), n + unit — скільки лишилось
  `CREATE TABLE IF NOT EXISTS char_effects (id INTEGER PRIMARY KEY AUTOINCREMENT, char_id INTEGER NOT NULL, room_id TEXT NOT NULL, key TEXT, data TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, unit TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_char_effects ON char_effects(char_id)`,
  // власні ефекти майстра (каталог, спільний для всіх його кімнат)
  `CREATE TABLE IF NOT EXISTS master_effects (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, data TEXT NOT NULL, created_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_master_effects_owner ON master_effects(owner_id)`,
  // свої вороги майстра (бестіарій, спільний для всіх його кімнат)
  `CREATE TABLE IF NOT EXISTS master_monsters (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, data TEXT NOT NULL, created_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_master_monsters_owner ON master_monsters(owner_id)`,
  // учасники бою з ініціативою: персонажі (char_id) і вороги (mon: b:ключ бестіарію | m:свій; data — знімок свого ворога)
  `CREATE TABLE IF NOT EXISTS combatants (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL, char_id INTEGER, mon TEXT, data TEXT, name TEXT NOT NULL, num INTEGER NOT NULL DEFAULT 0, init INTEGER, init_mod INTEGER NOT NULL DEFAULT 0, hp INTEGER, hp_max INTEGER, ac INTEGER, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_combatants_event ON combatants(event_id)`,
];
const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];
const DICE_HISTORY = 15;
const MAX_MY_ITEMS = 500;
const MAX_MY_EFFECTS = 200;
const MAX_CHAR_EFFECTS = 30;
// Тривалість ефекту текстом (журнал; перекладається за словником)
const FX_UNITS_UK = { round: ['раунд', 'раунди', 'раундів'], min: ['хвилина', 'хвилини', 'хвилин'], hour: ['година', 'години', 'годин'], day: ['день', 'дні', 'днів'] };
const slavForm = (n, f) => { const a = n % 10; const b = n % 100; return f[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 1 : 2]; };
const fxDur = (n, unit) => (unit === 'perm' ? 'до зняття' : unit === 'lvl' ? `рівень ${n}` : `${n} ${slavForm(n, FX_UNITS_UK[unit] || FX_UNITS_UK.round)}`);
function fxDuration(n, unit, def) {
  if (def && def.def && def.def.unit === 'lvl') return { n: int(n, 1, def.max || 6, 1), unit: 'lvl' };
  const u = R.EFFECT_UNITS.includes(unit) ? unit : 'round';
  return u === 'perm' ? { n: 0, unit: 'perm' } : { n: int(n, 1, 999, 1), unit: u };
}
function sanitizeEffect(e) {
  e = e && typeof e === 'object' ? e : {};
  const name = str(e.name, 60).trim();
  if (!name) fail('Вкажи назву ефекту');
  const icon = [...str(e.icon, 16).trim()].slice(0, 4).join('') || '✨';
  const def = e.def && typeof e.def === 'object' ? fxDuration(e.def.n, e.def.unit) : { n: 10, unit: 'round' };
  return { name, icon, desc: str(e.desc, 1500).trim(), def };
}
async function loadEffects(c, ids) {
  if (!ids.length) return [];
  return (await all(c.db, 'SELECT * FROM char_effects WHERE char_id IN (SELECT value FROM json_each(?)) ORDER BY id', JSON.stringify(ids)))
    .map((r) => ({ id: r.id, charId: r.char_id, key: r.key, n: r.n, unit: r.unit, ...JSON.parse(r.data) }));
}

const MAX_PLAYERS = 10;
const MAX_ATTUNED = 3;
const INIT_DATA_MAX_AGE = 7 * 24 * 3600;

class UserError extends Error {}
const fail = (msg) => { throw new UserError(msg); };
const now = () => Math.floor(Date.now() / 1000);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Init-Data',
  'Access-Control-Max-Age': '86400',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    try {
      if (url.pathname === '/api' && request.method === 'POST') return await handleApi(request, env, ctx);
      if (url.pathname === '/bot' && request.method === 'POST') return await handleBot(request, env, ctx);
      if (url.pathname === '/setup') return await handleSetup(url, env);
      if (url.pathname === '/') return json({ ok: true, service: 'DnD Companion API', configured: !!env.BOT_TOKEN && !!env.DB });
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: 'Помилка сервера: ' + (e && e.message) }, 500);
    }
  },
};

// ---------------- База даних ----------------
let schemaReady = null;
function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = db.batch(SCHEMA.map((s) => db.prepare(s)))
      // версія кімнати для миттєвого оновлення (колонка могла вже існувати)
      .then(() => db.prepare('ALTER TABLE rooms ADD COLUMN version INTEGER NOT NULL DEFAULT 0').run().catch(() => {}))
      // максимальний початковий рівень персонажів (1 — лише з першого)
      .then(() => db.prepare('ALTER TABLE rooms ADD COLUMN max_start_level INTEGER NOT NULL DEFAULT 1').run().catch(() => {}))
      // мова інтерфейсу й сповіщень користувача (uk / ru / en)
      .then(() => db.prepare('ALTER TABLE users ADD COLUMN lang TEXT').run().catch(() => {}))
      // гравець попросив майстра допомогти створити персонажа (час прохання)
      .then(() => db.prepare('ALTER TABLE members ADD COLUMN help_req INTEGER').run().catch(() => {}))
      // активна подія кімнати; прив'язка записів журналу й кидків до події; позначка «промах» для кидка шкоди
      .then(() => db.prepare('ALTER TABLE rooms ADD COLUMN event_id INTEGER').run().catch(() => {}))
      .then(() => db.prepare('ALTER TABLE logs ADD COLUMN event_id INTEGER').run().catch(() => {}))
      .then(() => db.prepare('ALTER TABLE dice_rolls ADD COLUMN event_id INTEGER').run().catch(() => {}))
      .then(() => db.prepare('ALTER TABLE dice_rolls ADD COLUMN miss INTEGER NOT NULL DEFAULT 0').run().catch(() => {}))
      // сесія кидка (стрічка кидків майстра) і зв'язок запису журналу з кидком (видалення кидка прибирає і запис)
      .then(() => db.prepare('ALTER TABLE dice_rolls ADD COLUMN session INTEGER').run().catch(() => {}))
      .then(() => db.prepare('ALTER TABLE logs ADD COLUMN roll_id INTEGER').run().catch(() => {}))
      // бій: номер раунду (0 — збір ініціативи) і чий хід
      .then(() => db.prepare('ALTER TABLE events ADD COLUMN round INTEGER NOT NULL DEFAULT 0').run().catch(() => {}))
      .then(() => db.prepare('ALTER TABLE events ADD COLUMN turn_id INTEGER').run().catch(() => {}))
      // хід персонажа в бою: витрачені дія/бонусна дія, атаки, що лишились, кидок на рішенні майстра, очікуваний кидок шкоди
      .then(() => db.prepare('ALTER TABLE combatants ADD COLUMN turn TEXT').run().catch(() => {}))
      // подію, що «перетекла» в іншу, позначаємо: її записи вже в тій події
      .then(() => db.prepare('ALTER TABLE events ADD COLUMN merged_into INTEGER').run().catch(() => {}))
      .catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bumpRoom = (c, roomId) => run(c.db, 'UPDATE rooms SET version = version + 1 WHERE id = ?', roomId);
const q = (db, sql, ...args) => db.prepare(sql).bind(...args);
const first = (db, sql, ...args) => q(db, sql, ...args).first();
const all = async (db, sql, ...args) => (await q(db, sql, ...args).all()).results || [];
const run = (db, sql, ...args) => q(db, sql, ...args).run();

// ---------------- Telegram ----------------
async function tg(env, method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return r.json().catch(() => ({ ok: false }));
}

async function sendDocument(env, chatId, filename, text, caption) {
  const fd = new FormData();
  fd.append('chat_id', String(chatId));
  if (caption) fd.append('caption', caption);
  fd.append('document', new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }), filename);
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendDocument`, { method: 'POST', body: fd });
  return r.json().catch(() => ({ ok: false }));
}

const enc = new TextEncoder();
async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, typeof data === 'string' ? enc.encode(data) : data));
}
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  const entries = [];
  for (const [k, v] of params) if (k !== 'hash') entries.push([k, v]);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  for (const skipSignature of [false, true]) {
    const dcs = entries.filter(([k]) => !(skipSignature && k === 'signature')).map(([k, v]) => `${k}=${v}`).join('\n');
    if (safeEqual(hex(await hmac(secret, dcs)), hash)) {
      const authDate = Number(params.get('auth_date') || 0);
      if (now() - authDate > INIT_DATA_MAX_AGE) return null;
      try { return JSON.parse(params.get('user') || 'null'); } catch { return null; }
    }
  }
  return null;
}

async function webhookSecret(env) {
  return hex(await hmac(enc.encode('dnd-webhook'), env.BOT_TOKEN)).slice(0, 48);
}

let cachedBotUsername = null;
async function botUsername(env) {
  if (cachedBotUsername) return cachedBotUsername;
  const me = await tg(env, 'getMe', {});
  if (me.ok) cachedBotUsername = me.result.username;
  return cachedBotUsername || env.BOT_USERNAME || '';
}

// Мова користувача (кешується в межах запиту)
function userLang(c, id) {
  if (id === c.user.id) return Promise.resolve(c.user.lang);
  if (!c.langs) c.langs = new Map();
  if (!c.langs.has(id)) c.langs.set(id, first(c.db, 'SELECT lang FROM users WHERE id = ?', id).then((r) => normLang(r && r.lang)).catch(() => 'uk'));
  return c.langs.get(id);
}
function notify(c, chatId, text) {
  if (!chatId || !c.env.BOT_TOKEN) return;
  const p = userLang(c, chatId)
    .then((lang) => tg(c.env, 'sendMessage', { chat_id: chatId, text: tr(lang, text), disable_web_page_preview: true }))
    .catch(() => {});
  if (c.ctx && c.ctx.waitUntil) c.ctx.waitUntil(p);
}
// Кнопка меню бота мовою користувача
function menuButton(env, chatId, lang) {
  return tg(env, 'setChatMenuButton', { chat_id: chatId, menu_button: { type: 'web_app', text: tr(lang, '🎲 Грати'), web_app: { url: env.APP_URL } } });
}

// ---------------- /setup ----------------
async function handleSetup(url, env) {
  if (!env.BOT_TOKEN) return json({ ok: false, error: 'Не задано секрет BOT_TOKEN у налаштуваннях Worker' }, 500);
  await ensureSchema(env.DB);
  const appUrl = env.APP_URL;
  const results = {};
  results.getMe = await tg(env, 'getMe', {});
  results.setWebhook = await tg(env, 'setWebhook', {
    url: `${url.origin}/bot`, secret_token: await webhookSecret(env),
    allowed_updates: ['message'], drop_pending_updates: true,
  });
  results.setChatMenuButton = await tg(env, 'setChatMenuButton', {
    menu_button: { type: 'web_app', text: '🎲 Грати', web_app: { url: appUrl } },
  });
  // типові тексти — українською, плюс окремі для російської та англійської мов Telegram
  for (const [lang, code] of [['uk', null], ['uk', 'uk'], ['ru', 'ru'], ['en', 'en']]) {
    const lc = code ? { language_code: code } : {};
    const sfx = code || 'default';
    results[`setMyCommands_${sfx}`] = await tg(env, 'setMyCommands', {
      ...lc,
      commands: [
        { command: 'start', description: tr(lang, 'Відкрити DnD Companion') },
        { command: 'help', description: tr(lang, 'Як користуватися ботом') },
      ],
    });
    results[`setMyDescription_${sfx}`] = await tg(env, 'setMyDescription', {
      ...lc,
      description: tr(lang, 'DnD Companion — листи персонажів D&D 5e, інвентар і кімнати для майстра та гравців прямо в Telegram. Натисни «Почати», щоб відкрити застосунок.'),
    });
    results[`setMyShortDescription_${sfx}`] = await tg(env, 'setMyShortDescription', {
      ...lc,
      short_description: tr(lang, 'Листи персонажів, інвентар і кімнати D&D 5e для майстра та гравців.'),
    });
  }
  const ok = Object.values(results).every((r) => r && r.ok);
  return json({ ok, appUrl, webhook: `${url.origin}/bot`, results });
}

// ---------------- /bot (вебхук) ----------------
async function handleBot(request, env) {
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!env.BOT_TOKEN || !safeEqual(secret, await webhookSecret(env))) return new Response('forbidden', { status: 403 });
  const update = await request.json().catch(() => ({}));
  const msg = update.message;
  if (!msg || !msg.chat || msg.chat.type !== 'private') return new Response('ok');
  const text = (msg.text || '').trim();
  const appUrl = env.APP_URL;
  // мова відповіді: обрана в застосунку, інакше мова Telegram
  await ensureSchema(env.DB);
  const urow = msg.from ? await first(env.DB, 'SELECT lang FROM users WHERE id = ?', msg.from.id).catch(() => null) : null;
  const lang = normLang((urow && urow.lang) || langFromTg(msg.from && msg.from.language_code));
  const L = (s) => tr(lang, s);
  if (text.startsWith('/help')) {
    await tg(env, 'sendMessage', {
      chat_id: msg.chat.id,
      text: L('Як грати:\n\n🧙 Майстер: відкрий застосунок → «Майстер» → створи кімнату → надішли гравцям посилання-запрошення.\n\n⚔️ Гравець: відкрий запрошення або введи код кімнати → створи персонажа.\n\nМайстер бачить усіх персонажів, видає предмети з каталогу D&D 5e, змінює характеристики, нараховує досвід. Гравці бачать лише свій лист і інвентар.'),
      reply_markup: { inline_keyboard: [[{ text: L('🎲 Відкрити застосунок'), web_app: { url: appUrl } }]] },
    });
    return new Response('ok');
  }
  let payload = '';
  const m = text.match(/^\/start(?:@\w+)?\s+(\S+)/);
  if (m) payload = m[1].replace(/^(join_|room_)/i, '').toUpperCase();
  if (payload && /^[A-Z0-9]{4,10}$/.test(payload)) {
    const room = await first(env.DB, 'SELECT id, name FROM rooms WHERE id = ? AND deleted = 0', payload);
    if (room) {
      await tg(env, 'sendMessage', {
        chat_id: msg.chat.id,
        text: L(`Тебе запросили до кімнати «${room.name}» (код ${room.id}). Натисни кнопку, щоб приєднатися як гравець.`),
        reply_markup: { inline_keyboard: [[{ text: L('⚔️ Приєднатися до гри'), web_app: { url: `${appUrl}?room=${room.id}` } }]] },
      });
      return new Response('ok');
    }
    await tg(env, 'sendMessage', { chat_id: msg.chat.id, text: L(`Кімнату з кодом ${payload} не знайдено. Перепитай майстра.`) });
    return new Response('ok');
  }
  await tg(env, 'sendMessage', {
    chat_id: msg.chat.id,
    text: L('Вітаю в DnD Companion! 🐉\nТут майстер створює кімнати, а гравці ведуть листи персонажів D&D 5e та інвентар.\n\nНатисни кнопку нижче або «🎲 Грати» біля поля вводу.'),
    reply_markup: { inline_keyboard: [[{ text: L('🎲 Відкрити застосунок'), web_app: { url: appUrl } }]] },
  });
  return new Response('ok');
}

// ---------------- /api ----------------
async function handleApi(request, env, ctx) {
  if (!env.BOT_TOKEN) return json({ error: 'Сервер ще не налаштований: немає токена бота.' }, 500);
  const tgUser = await verifyInitData(request.headers.get('X-Init-Data') || '', env.BOT_TOKEN);
  if (!tgUser || !tgUser.id) {
    return json({ error: 'auth', message: 'Не вдалося підтвердити вхід через Telegram. Закрий і знову відкрий застосунок із бота.' }, 401);
  }
  await ensureSchema(env.DB);
  const body = await request.json().catch(() => ({}));
  const fn = OPS[body.op];
  if (!fn) return json({ error: 'Невідома дія' }, 400);
  const user = await upsertUser(env.DB, tgUser);
  const c = { env, ctx, db: env.DB, user };
  try {
    const res = await fn(c, body);
    return json(res === undefined ? { ok: true } : res);
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Помилка сервера: ' + e.message }, 500);
  }
}

async function upsertUser(db, u) {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').slice(0, 64) || 'Гравець';
  const t = now();
  // нові користувачі отримують мову свого Telegram; далі її змінює перемикач у застосунку
  await run(db, `INSERT INTO users (id, first_name, username, role, created_at, updated_at, lang) VALUES (?, ?, ?, NULL, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name, username = excluded.username, updated_at = excluded.updated_at`,
  u.id, name, u.username || null, t, t, langFromTg(u.language_code));
  const row = await first(db, 'SELECT * FROM users WHERE id = ?', u.id);
  return { id: row.id, name: row.first_name, username: row.username, role: row.role, lang: normLang(row.lang) };
}

// ---------------- Допоміжні ----------------
const str = (v, max = 200) => (v == null ? '' : String(v)).trim().slice(0, max);
function int(v, min, max, def = null) {
  if (v === '' || v == null) return def;
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return def;
  return R.clamp(n, min, max);
}
const isInt = (v) => Number.isInteger(v);

async function getRoom(c, roomId) {
  const room = await first(c.db, 'SELECT * FROM rooms WHERE id = ? AND deleted = 0', str(roomId, 12).toUpperCase());
  if (!room) fail('Кімнату не знайдено або її видалено');
  return room;
}
async function requireMaster(c, roomId) {
  const room = await getRoom(c, roomId);
  if (room.master_id !== c.user.id) fail('Це може робити лише майстер кімнати');
  return room;
}
async function isMember(c, roomId, userId = c.user.id) {
  return !!(await first(c.db, 'SELECT 1 AS x FROM members WHERE room_id = ? AND user_id = ?', roomId, userId));
}
function parseChar(row) {
  if (!row) return null;
  return { id: row.id, roomId: row.room_id, userId: row.user_id, alive: !!row.alive, sheet: JSON.parse(row.sheet), createdAt: row.created_at };
}
function parseItem(row) {
  return { id: row.id, charId: row.char_id, data: JSON.parse(row.data), qty: row.qty, equipped: !!row.equipped, attuned: !!row.attuned };
}
async function loadItems(c, charIds) {
  if (!charIds.length) return [];
  const rows = await all(c.db, `SELECT * FROM items WHERE char_id IN (${charIds.map(() => '?').join(',')}) ORDER BY id`, ...charIds);
  return rows.map(parseItem);
}
async function fullChar(c, ch) {
  ch.items = await loadItems(c, [ch.id]);
  ch.effects = await loadEffects(c, [ch.id]);
  ch.rolls = (await all(c.db, 'SELECT id, ts, data, miss FROM dice_rolls WHERE char_id = ? ORDER BY id DESC LIMIT ?', ch.id, DICE_HISTORY))
    .map((r) => ({ id: r.id, ts: r.ts, mark: r.miss || 0, ...JSON.parse(r.data) }));
  return ch;
}

// Доступ до персонажа: owner — власник, master — майстер кімнати
async function charAccess(c, charId, { owner = false, master = false, alive = true } = {}) {
  const row = await first(c.db, 'SELECT * FROM characters WHERE id = ?', int(charId, 0, 1e12, 0));
  if (!row) fail('Персонажа не знайдено');
  const ch = parseChar(row);
  const room = await getRoom(c, ch.roomId);
  const isOwner = ch.userId === c.user.id;
  const isMaster = room.master_id === c.user.id;
  if (!((owner && isOwner) || (master && isMaster))) fail('Немає доступу до цього персонажа');
  if (isOwner && !isMaster && !(await isMember(c, room.id))) fail('Ти більше не в цій кімнаті');
  if (alive && !ch.alive) fail('Персонаж загинув');
  // персонаж, якого стосується дія, — для запису в його подію
  if (!c.ch) c.ch = ch;
  return { ch, room, isOwner, isMaster };
}
async function itemAccess(c, itemId, opts) {
  const row = await first(c.db, 'SELECT * FROM items WHERE id = ?', int(itemId, 0, 1e12, 0));
  if (!row) fail('Предмет не знайдено (можливо, його вже змінили). Онови екран.');
  const item = parseItem(row);
  const acc = await charAccess(c, item.charId, opts);
  return { item, ...acc };
}
async function saveSheet(c, ch) {
  await run(c.db, 'UPDATE characters SET sheet = ?, updated_at = ? WHERE id = ?', JSON.stringify(ch.sheet), now(), ch.id);
}

// Активна подія, у якій зараз персонаж (кеш у межах запиту)
async function charEventId(c, charId) {
  if (!c.evc) c.evc = new Map();
  if (!c.evc.has(charId)) {
    const r = await first(c.db, `SELECT em.event_id FROM event_members em JOIN events e ON e.id = em.event_id
      WHERE em.char_id = ? AND em.left_at IS NULL AND e.ended_at IS NULL ORDER BY em.id DESC LIMIT 1`, charId);
    c.evc.set(charId, r ? r.event_id : null);
  }
  return c.evc.get(charId);
}
// evId: подія запису; якщо не вказано — подія персонажа, якого стосується дія
async function addLog(c, room, text, actorOverride, evId, rollId) {
  const actor = actorOverride || (room.master_id === c.user.id ? `Майстер ${c.user.name}` : c.user.name);
  if (evId === undefined) evId = c.ch && c.ch.roomId === room.id ? await charEventId(c, c.ch.id) : null;
  await c.db.batch([
    q(c.db, 'INSERT INTO logs (room_id, session, ts, actor_id, actor, text, event_id, roll_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', room.id, room.session, now(), c.user.id, actor, text, evId || null, rollId || null),
    q(c.db, 'UPDATE rooms SET version = version + 1 WHERE id = ?', room.id),
  ]);
}
const charActor = (c, ch) => `${ch.sheet.name} (${c.user.name})`;
// Дія персонажа під час активної події (для структурованого звіту)
async function evAct(c, room, ch, kind, value = 1, data = null) {
  if (!value) return;
  const evId = await charEventId(c, ch.id);
  if (!evId) return;
  await run(c.db, 'INSERT INTO event_acts (event_id, char_id, ts, kind, value, data) VALUES (?, ?, ?, ?, ?, ?)',
    evId, ch.id, now(), kind, value, data ? JSON.stringify(data) : null);
}
// Для кого створюється персонаж: сам гравець або (за його проханням) майстер замість гравця
async function creationTarget(c, room, forUserId) {
  const uid = forUserId == null || forUserId === '' ? c.user.id : int(forUserId, 1, 1e15, 0);
  const helper = uid !== c.user.id;
  if (helper && room.master_id !== c.user.id) fail('Це може робити лише майстер кімнати');
  const mem = await first(c.db, 'SELECT * FROM members WHERE room_id = ? AND user_id = ?', room.id, uid);
  if (!mem) fail(helper ? 'Гравець уже не в кімнаті' : 'Ти не в цій кімнаті');
  if (await first(c.db, 'SELECT 1 AS x FROM characters WHERE room_id = ? AND user_id = ? AND alive = 1', room.id, uid)) {
    fail(helper ? 'У гравця вже є інший живий персонаж' : 'У тебе вже є живий персонаж');
  }
  if (helper && !mem.help_req) fail('Гравець не просив допомоги або скасував прохання');
  const u = helper ? await first(c.db, 'SELECT first_name FROM users WHERE id = ?', uid) : null;
  return { uid, helper, mem, name: helper ? (u ? u.first_name : String(uid)) : c.user.name };
}
const itemName = (it) => `«${it.data.name}»`;
const moneyStr = (m) => R.COINS.filter((k) => m[k]).map((k) => `${m[k]} ${R.COIN_NAMES[k]}`).join(', ') || '0';

function roomCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  return [...buf].map((x) => abc[x % abc.length]).join('');
}

// ---------------- Санітизація ----------------
export function sanitizeItem(d) {
  d = d || {};
  const o = {};
  o.name = str(d.name, 80);
  if (!o.name) fail('Вкажіть назву предмета');
  o.rarity = R.RARITY_IDS.includes(d.rarity) ? d.rarity : 'common';
  o.type = R.ITEM_TYPES[d.type] ? d.type : 'other';
  o.cost = str(d.cost, 30);
  o.weight = d.weight === '' || d.weight == null ? null : R.clamp(Number(d.weight) || 0, 0, 100000);
  o.damage = str(d.damage, 30);
  o.dmgType = str(d.dmgType, 30);
  o.damage2 = str(d.damage2, 30);
  o.props = str(d.props, 300);
  o.ranged = !!d.ranged;
  o.ac = int(d.ac, 0, 30);
  o.dexMax = int(d.dexMax, 0, 10);
  o.strReq = int(d.strReq, 0, 30);
  o.stealthDis = !!d.stealthDis;
  o.bonus = int(d.bonus, -5, 5, 0);
  o.acBonus = int(d.acBonus, -5, 10, 0);
  o.attune = str(d.attune, 80);
  o.charges = str(d.charges, 40);
  o.desc = str(d.desc, 4000);
  o.catalogId = str(d.catalogId, 60);
  o.cat = R.ITEM_CATS[d.cat] ? d.cat : '';
  o.kind = d.type === 'weapon' && R.WEAPON_PROF[d.kind] && !['simple', 'martial'].includes(d.kind) ? d.kind : '';
  for (const k of Object.keys(o)) if (o[k] === '' || o[k] === null || o[k] === false || (k === 'bonus' && o[k] === 0) || (k === 'acBonus' && o[k] === 0)) delete o[k];
  o.name = str(d.name, 80); o.rarity = o.rarity || 'common'; o.type = o.type || 'other';
  if (d.consumable === true || d.consumable === false) o.consumable = d.consumable;
  return o;
}

function sanitizeSpells(list) {
  if (!Array.isArray(list)) fail('Невірний список заклять');
  if (list.length > 300) fail('Забагато заклять');
  return list.map((s) => {
    if (s.sid && R.SPELLS[s.sid]) {
      const sp = R.SPELLS[s.sid];
      const e = { id: str(s.id, 24) || Math.random().toString(36).slice(2, 10), sid: sp.id, pool: str(s.pool, 20) || 'extra', name: sp.name, level: sp.level, prepared: !!s.prepared };
      if (s.by === 'm') e.by = 'm';
      return e;
    }
    const name = str(s.name, 80);
    if (!name) fail('У закляття має бути назва');
    return {
      id: str(s.id, 24) || Math.random().toString(36).slice(2, 10),
      name, level: int(s.level, 0, 9, 0), school: str(s.school, 40), time: str(s.time, 60), range: str(s.range, 60),
      comp: str(s.comp, 120), dur: str(s.dur, 60), desc: str(s.desc, 3000), prepared: !!s.prepared, ritual: !!s.ritual, conc: !!s.conc,
    };
  });
}

function sanitizeText(text) {
  const out = {};
  if (!text || typeof text !== 'object') return out;
  for (const k of R.TEXT_FIELD_IDS) if (k in text) out[k] = str(text[k], k.length <= 6 && ['age', 'height', 'weight', 'eyes', 'skin', 'hair'].includes(k) ? 40 : 4000);
  return out;
}

function sanitizeMoney(m, allowNegative = false) {
  const o = {};
  for (const k of R.COINS) o[k] = int(m && m[k], allowNegative ? -1e9 : 0, 1e9, 0);
  return o;
}

// Майстер може змінювати все без обмежень правил
export function sanitizeSheetByMaster(input, old) {
  const s = JSON.parse(JSON.stringify(old));
  const i = input || {};
  if ('name' in i) s.name = str(i.name, 60) || s.name;
  if ('raceId' in i && (R.RACES[i.raceId] || i.raceId === 'custom')) s.raceId = i.raceId;
  if ('raceName' in i) s.raceName = str(i.raceName, 60);
  if ('classId' in i && R.CLASSES[i.classId]) s.classId = i.classId;
  if ('backgroundId' in i && R.BACKGROUNDS[i.backgroundId]) s.backgroundId = i.backgroundId;
  if ('subclass' in i) s.subclass = str(i.subclass, 60);
  if ('subclassId' in i) {
    const sc = R.subclassSpec(s.classId, i.subclassId);
    if (sc) { s.subclassId = i.subclassId; s.subclass = sc.name; } else if (!i.subclassId) s.subclassId = '';
  }
  if ('passiveBonus' in i) s.passiveBonus = int(i.passiveBonus, -20, 20, 0);
  if ('alignment' in i) s.alignment = str(i.alignment, 40);
  if ('level' in i) s.level = int(i.level, 1, 20, s.level);
  if ('xp' in i) s.xp = int(i.xp, 0, 1e7, s.xp);
  if ('targetLevel' in i) s.targetLevel = int(i.targetLevel, 1, 20, s.targetLevel);
  s.targetLevel = Math.max(s.targetLevel || 1, s.level);
  if (i.abilities) for (const a of R.ABILITIES) if (a in i.abilities) s.abilities[a] = int(i.abilities[a], 1, 30, s.abilities[a]);
  if (Array.isArray(i.saves)) s.saves = R.ABILITIES.filter((a) => i.saves.includes(a));
  if (i.skills && typeof i.skills === 'object') {
    const merged = { ...s.skills };
    for (const k of R.SKILL_IDS) {
      if (!(k in i.skills)) continue;
      const v = int(i.skills[k], 0, 2, 0);
      if (v) merged[k] = v; else delete merged[k];
    }
    s.skills = merged;
  }
  if (i.hp) {
    if ('max' in i.hp) s.hp.max = int(i.hp.max, 1, 9999, s.hp.max);
    if ('cur' in i.hp) s.hp.cur = int(i.hp.cur, 0, 9999, s.hp.cur);
    if ('temp' in i.hp) s.hp.temp = int(i.hp.temp, 0, 9999, s.hp.temp);
  }
  if ('hitDiceUsed' in i) s.hitDiceUsed = int(i.hitDiceUsed, 0, 20, s.hitDiceUsed);
  if (i.deathSaves) {
    if ('s' in i.deathSaves) s.deathSaves.s = int(i.deathSaves.s, 0, 3, 0);
    if ('f' in i.deathSaves) s.deathSaves.f = int(i.deathSaves.f, 0, 3, 0);
  }
  if ('inspiration' in i) s.inspiration = i.inspiration === true ? 1 : i.inspiration === false ? 0 : int(i.inspiration, 0, 99, R.inspCount(s));
  if ('speed' in i) s.speed = int(i.speed, 0, 500, s.speed);
  if ('acBonus' in i) s.acBonus = int(i.acBonus, -30, 30, 0);
  if ('acOverride' in i) s.acOverride = int(i.acOverride, 0, 60, null);
  if ('initBonus' in i) s.initBonus = int(i.initBonus, -30, 30, 0);
  if ('profOverride' in i) s.profOverride = int(i.profOverride, 0, 10, null);
  if (i.text) Object.assign(s.text, sanitizeText(i.text));
  if (i.spell) {
    if ('ability' in i.spell) s.spell.ability = R.ABILITIES.includes(i.spell.ability) ? i.spell.ability : null;
    if ('slotsOverride' in i.spell) {
      s.spell.slotsOverride = Array.isArray(i.spell.slotsOverride)
        ? i.spell.slotsOverride.slice(0, 9).map((v) => int(v, 0, 20, 0)) : null;
    }
    if (Array.isArray(i.spell.slotsUsed)) s.spell.slotsUsed = i.spell.slotsUsed.slice(0, 9).map((v) => int(v, 0, 20, 0));
    if (Array.isArray(i.spell.spells)) s.spell.spells = sanitizeSpells(i.spell.spells);
  }
  if (i.money) s.money = sanitizeMoney(i.money);
  if (i.prof && typeof i.prof === 'object') s.prof = sanitizeProf(i.prof);
  return s;
}
function sanitizeProf(p) {
  const pick = (arr, dict) => [...new Set((Array.isArray(arr) ? arr : []).map(String))].filter((x) => dict[x]);
  return { armor: pick(p.armor, R.ARMOR_PROF), weapons: pick(p.weapons, R.WEAPON_PROF), tools: pick(p.tools, R.TOOLS), languages: pick(p.languages, R.LANGUAGES) };
}

// Людиночитний перелік змін листа
export function describeSheetDiff(a, b) {
  const out = [];
  const cmp = (label, x, y) => { if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`${label}: ${fmtV(x)} → ${fmtV(y)}`); };
  const fmtV = (v) => (v === null || v === undefined || v === '' ? '—' : v === true ? 'так' : v === false ? 'ні' : String(v));
  cmp('Ім’я', a.name, b.name);
  cmp('Раса', raceLabel(a), raceLabel(b));
  cmp('Клас', R.CLASSES[a.classId]?.name, R.CLASSES[b.classId]?.name);
  cmp('Підклас', a.subclass, b.subclass);
  cmp('Передісторія', R.BACKGROUNDS[a.backgroundId]?.name, R.BACKGROUNDS[b.backgroundId]?.name);
  cmp('Світогляд', a.alignment, b.alignment);
  cmp('Рівень', a.level, b.level);
  cmp('Досвід', a.xp, b.xp);
  cmp('Доступний рівень', a.targetLevel, b.targetLevel);
  for (const ab of R.ABILITIES) cmp(R.ABILITY_SHORT[ab], a.abilities[ab], b.abilities[ab]);
  for (const ab of R.ABILITIES) {
    const x = a.saves.includes(ab); const y = b.saves.includes(ab);
    if (x !== y) out.push(`Рятівний кидок ${R.ABILITY_SHORT[ab]}: ${y ? 'володіння' : 'без володіння'}`);
  }
  const lv = ['без володіння', 'володіння', 'експертиза'];
  for (const k of R.SKILL_IDS) {
    const x = a.skills[k] || 0; const y = b.skills[k] || 0;
    if (x !== y) out.push(`${R.SKILLS[k][0]}: ${lv[y]}`);
  }
  cmp('Макс. ХП', a.hp.max, b.hp.max);
  cmp('ХП', a.hp.cur, b.hp.cur);
  cmp('Тимч. ХП', a.hp.temp, b.hp.temp);
  cmp('Використані кості хітів', a.hitDiceUsed, b.hitDiceUsed);
  cmp('Успіхи рятівних від смерті', a.deathSaves.s, b.deathSaves.s);
  cmp('Провали рятівних від смерті', a.deathSaves.f, b.deathSaves.f);
  cmp('Натхнення', R.inspCount(a), R.inspCount(b));
  cmp('Швидкість', a.speed, b.speed);
  cmp('Бонус КЗ', a.acBonus, b.acBonus);
  cmp('КЗ (вручну)', a.acOverride, b.acOverride);
  cmp('Бонус ініціативи', a.initBonus, b.initBonus);
  cmp('Бонус майстерності (вручну)', a.profOverride, b.profOverride);
  for (const k of R.TEXT_FIELD_IDS) if ((a.text[k] || '') !== (b.text[k] || '')) out.push(`${R.TEXT_FIELDS[k]}: оновлено`);
  cmp('Характеристика заклять', a.spell.ability && R.ABILITY_SHORT[a.spell.ability], b.spell.ability && R.ABILITY_SHORT[b.spell.ability]);
  cmp('Комірки заклять (вручну)', a.spell.slotsOverride && a.spell.slotsOverride.join('/'), b.spell.slotsOverride && b.spell.slotsOverride.join('/'));
  for (let i = 0; i < 9; i++) {
    const x = (a.spell.slotsUsed || [])[i] || 0; const y = (b.spell.slotsUsed || [])[i] || 0;
    if (x !== y) out.push(`Використано комірок ${i + 1} кола: ${x} → ${y}`);
  }
  out.push(...spellsDiff(a.spell.spells, b.spell.spells));
  cmp('Бонус пасивної уважності', a.passiveBonus || 0, b.passiveBonus || 0);
  if (b.prof) {
    const pa = R.profOf(a); const pb = R.profOf(b);
    for (const [k, dict, label] of [['armor', R.ARMOR_PROF, 'обладунки'], ['weapons', R.WEAPON_PROF, 'зброя'], ['tools', R.TOOLS, 'інструменти'], ['languages', R.LANGUAGES, 'мови']]) {
      const add = pb[k].filter((x) => !pa[k].includes(x)).map((x) => dict[x]);
      const del = pa[k].filter((x) => !pb[k].includes(x)).map((x) => dict[x]);
      if (add.length) out.push(`Володіння (${label}): + ${add.join(', ')}`);
      if (del.length) out.push(`Володіння (${label}): − ${del.join(', ')}`);
    }
  }
  const resB = R.sheetResources(b);
  for (const r of resB) {
    const x = Math.min(r.max, Number((a.resUsed || {})[r.id] || 0)); const y = r.used;
    if (x !== y) out.push(`${r.name}: використано ${x} → ${y} з ${r.max}`);
  }
  const fa = (a.features || []).map((x) => x.name); const fb = (b.features || []).map((x) => x.name);
  const fAdd = fb.filter((n) => !fa.includes(n)); const fDel = fa.filter((n) => !fb.includes(n));
  if (fAdd.length) out.push(`Нові вміння: ${fAdd.join(', ')}`);
  if (fDel.length) out.push(`Прибрано вміння: ${fDel.join(', ')}`);
  if (JSON.stringify(sanitizeMoney(a.money)) !== JSON.stringify(sanitizeMoney(b.money))) out.push(`Гроші: ${moneyStr(a.money)} → ${moneyStr(b.money)}`);
  return out;
}
function raceLabel(s) { return s.raceId === 'custom' ? s.raceName : R.RACES[s.raceId]?.name; }
function spellsDiff(a = [], b = []) {
  const out = [];
  const ma = new Map(a.map((s) => [s.id, s]));
  const mb = new Map(b.map((s) => [s.id, s]));
  const added = b.filter((s) => !ma.has(s.id)).map((s) => s.name);
  const removed = a.filter((s) => !mb.has(s.id)).map((s) => s.name);
  const prepared = b.filter((s) => ma.has(s.id) && !!ma.get(s.id).prepared !== !!s.prepared).map((s) => `${s.name} ${s.prepared ? '(підготовлено)' : '(не підготовлено)'}`);
  const edited = b.filter((s) => ma.has(s.id) && JSON.stringify({ ...ma.get(s.id), prepared: 0 }) !== JSON.stringify({ ...s, prepared: 0 })).map((s) => s.name);
  if (added.length) out.push(`Нові закляття: ${added.join(', ')}`);
  if (removed.length) out.push(`Прибрано закляття: ${removed.join(', ')}`);
  if (prepared.length) out.push(`Підготовка: ${prepared.join(', ')}`);
  if (edited.length) out.push(`Змінено закляття: ${edited.join(', ')}`);
  return out;
}

async function addItemToChar(c, charId, data, qty) {
  const key = JSON.stringify(data);
  const existing = (await all(c.db, 'SELECT * FROM items WHERE char_id = ?', charId)).find((r) => r.data === key);
  if (existing) {
    await run(c.db, 'UPDATE items SET qty = qty + ? WHERE id = ?', qty, existing.id);
    return existing.id;
  }
  const r = await run(c.db, 'INSERT INTO items (char_id, data, qty, equipped, attuned, created_at) VALUES (?, ?, ?, 0, 0, ?)', charId, key, qty, now());
  return r.meta && r.meta.last_row_id;
}

// Видача стартових предметів: обладунок, щит і зброя одразу екіпіровані (якщо є володіння)
async function giveStartItems(c, charId, sheet, items) {
  let armorOn = false;
  const stmts = [];
  for (const [id, qty] of items) {
    const cat = CATALOG_BY_ID[id];
    if (!cat) continue;
    const data = sanitizeItem({ ...cat });
    let eq = 0;
    if (data.type === 'armor' && !armorOn && R.armorProficient(sheet, data) !== false) { eq = 1; armorOn = true; }
    if (data.type === 'shield' && R.armorProficient(sheet, data) !== false) eq = 1;
    if (data.type === 'weapon') eq = 1;
    stmts.push(q(c.db, 'INSERT INTO items (char_id, data, qty, equipped, attuned, created_at) VALUES (?, ?, ?, ?, 0, ?)', charId, JSON.stringify(data), qty, eq, now()));
  }
  if (stmts.length) await c.db.batch(stmts);
}

async function decItem(c, item, n) {
  if (item.qty - n <= 0) await run(c.db, 'DELETE FROM items WHERE id = ?', item.id);
  else await run(c.db, 'UPDATE items SET qty = qty - ? WHERE id = ?', n, item.id);
  return Math.max(0, item.qty - n);
}

async function buildLogTxt(c, room, session) {
  const rows = session
    ? await all(c.db, 'SELECT * FROM logs WHERE room_id = ? AND session = ? ORDER BY id', room.id, session)
    : await all(c.db, 'SELECT * FROM logs WHERE room_id = ? ORDER BY id', room.id);
  const tz = 'Europe/Kyiv';
  const L = (s) => tr(c.user.lang, s);
  const fmt = (ts, withDate) => new Date(ts * 1000).toLocaleString(LOCALES[normLang(c.user.lang)], withDate
    ? { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const lines = [];
  lines.push(L(`DnD Companion — журнал кімнати «${room.name}» (код ${room.id})`));
  lines.push(session ? L(`Сесія ${session}`) : L('Повний журнал'));
  lines.push(L(`Сформовано: ${fmt(now(), true)}`));
  lines.push('='.repeat(48));
  const sums = session ? [] : await roomSummaries(c, room);
  const sessions = [...new Set([...rows.map((r) => r.session), ...sums.map((x) => x.session)])].sort((a, b) => a - b);
  for (const ss of session ? [session] : sessions) {
    if (!session) lines.push('', L(`--- Сесія ${ss} ---`));
    // завершена сесія — підсумок; поточна (і старі, завершені до появи підсумків) — записи журналу
    for (const x of sums.filter((y) => y.session === ss)) lines.push(...renderSummary(c.user.lang, room, x.data).slice(1));
    for (const r of rows.filter((y) => y.session === ss)) lines.push(`[${fmt(r.ts, true)}] ${L(r.actor)}: ${L(r.text)}`);
  }
  if (!rows.length && !sums.length) lines.push(L('(записів немає)'));
  return lines.join('\r\n');
}

async function archiveRows(c, onlyId) {
  const rows = await all(c.db, `SELECT ch.id, ch.room_id, ch.alive, ch.sheet, ch.created_at, ch.updated_at, r.name AS room_name, r.deleted AS room_deleted,
    (SELECT 1 FROM members m WHERE m.room_id = ch.room_id AND m.user_id = ch.user_id) AS is_member
    FROM characters ch LEFT JOIN rooms r ON r.id = ch.room_id
    WHERE ch.user_id = ? ${onlyId ? 'AND ch.id = ?' : ''} ORDER BY ch.id DESC`, ...(onlyId ? [c.user.id, onlyId] : [c.user.id]));
  return rows.map((r) => {
    const s = JSON.parse(r.sheet);
    const status = !r.alive ? 'dead' : r.room_deleted ? 'closed' : !r.is_member ? 'left' : 'active';
    return { id: r.id, roomId: r.room_id, roomName: r.room_name || '—', status, dead: !r.alive, roomClosed: !!r.room_deleted,
      name: s.name, classId: s.classId, raceId: s.raceId, raceName: s.raceName || '', level: s.level, subclass: s.subclass || '', subclassId: s.subclassId || '', createdAt: r.created_at, updatedAt: r.updated_at, sheet: s };
  });
}

// ---------------- Операції API ----------------
// ---------- Події: підсумки й звіт ----------
async function getEvent(c, id) { return id ? first(c.db, 'SELECT * FROM events WHERE id = ?', id) : null; }
const evTypeName = (t) => (R.EVENT_TYPES[t] || R.EVENT_TYPES.other)[0];
const charName = async (c, id) => { const r = await first(c.db, 'SELECT sheet FROM characters WHERE id = ?', id); return r ? JSON.parse(r.sheet).name : String(id); };
// Активні події кімнати з поточними учасниками
async function activeEvents(c, room) {
  // подія, розпочата до появи учасників (стара версія): учасники — усі живі персонажі
  if (room.event_id) {
    const old = await getEvent(c, room.event_id);
    if (old && !old.ended_at && !(await first(c.db, 'SELECT 1 AS x FROM event_members WHERE event_id = ?', old.id))) {
      for (const r of await all(c.db, 'SELECT id FROM characters WHERE room_id = ? AND alive = 1', room.id)) {
        if (!(await charEventId(c, r.id))) await run(c.db, 'INSERT INTO event_members (event_id, char_id, joined_at) VALUES (?, ?, ?)', old.id, r.id, old.started_at);
      }
    }
    await run(c.db, 'UPDATE rooms SET event_id = NULL WHERE id = ?', room.id);
    room.event_id = null;
    c.evc = null;
  }
  const evs = await all(c.db, 'SELECT * FROM events WHERE room_id = ? AND ended_at IS NULL ORDER BY id', room.id);
  for (const ev of evs) ev.members = (await all(c.db, 'SELECT char_id FROM event_members WHERE event_id = ? AND left_at IS NULL ORDER BY id', ev.id)).map((r) => r.char_id);
  return evs;
}
// Склад події: додані переходять з інших подій (спорожніла подія «перетікає» сюди — спільний звіт),
// прибрані виходять; якщо в цій події не лишилось нікого — вона завершується зі звітом
async function setEventMembers(c, room, ev, charIds) {
  const want = [...new Set(charIds.map((x) => int(x, 0, 1e12, 0)))];
  const valid = new Set((await all(c.db, 'SELECT id FROM characters WHERE room_id = ? AND alive = 1', room.id)).map((r) => r.id));
  const cur = new Set((await all(c.db, 'SELECT char_id FROM event_members WHERE event_id = ? AND left_at IS NULL', ev.id)).map((r) => r.char_id));
  const ts = now();
  const emptied = new Set();
  for (const id of want) {
    if (cur.has(id) || !valid.has(id)) continue;
    const from = await charEventId(c, id);
    const nm = await charName(c, id);
    if (from && from !== ev.id) {
      await run(c.db, 'UPDATE event_members SET left_at = ? WHERE event_id = ? AND char_id = ? AND left_at IS NULL', ts, from, id);
      await addLog(c, room, `${nm} переведено до події «${ev.name}»`, undefined, from);
      emptied.add(from);
    }
    await run(c.db, 'INSERT INTO event_members (event_id, char_id, joined_at) VALUES (?, ?, ?)', ev.id, id, ts);
    await addLog(c, room, `до події долучено: ${nm}`, undefined, ev.id);
  }
  for (const id of cur) {
    if (want.includes(id)) continue;
    await run(c.db, 'UPDATE event_members SET left_at = ? WHERE event_id = ? AND char_id = ? AND left_at IS NULL', ts, ev.id, id);
    await addLog(c, room, `з події виведено: ${await charName(c, id)}`, undefined, ev.id);
  }
  c.evc = null;
  const res = { merged: [], finished: null };
  // події, з яких перевели всіх учасників сюди, об'єднуються з цією (один спільний звіт)
  for (const id of emptied) {
    if (await first(c.db, 'SELECT 1 AS x FROM event_members WHERE event_id = ? AND left_at IS NULL', id)) continue;
    const from = await getEvent(c, id);
    if (from && !from.ended_at) { await mergeEventInto(c, room, from, ev); res.merged.push(from.name); }
  }
  if (!(await first(c.db, 'SELECT 1 AS x FROM event_members WHERE event_id = ? AND left_at IS NULL', ev.id))) res.finished = await finishEvent(c, room, ev);
  else await syncPcCombatants(c, room, ev);
  return res;
}
// Об'єднання: учасники й усі записи події from переходять у into
async function mergeEventInto(c, room, from, into) {
  await addLog(c, room, `подія «${from.name}» перейшла в подію «${into.name}»`, undefined, from.id);
  const ts = now();
  await c.db.batch([
    q(c.db, 'UPDATE logs SET event_id = ? WHERE event_id = ?', into.id, from.id),
    q(c.db, 'UPDATE dice_rolls SET event_id = ? WHERE event_id = ?', into.id, from.id),
    q(c.db, 'UPDATE event_acts SET event_id = ? WHERE event_id = ?', into.id, from.id),
    q(c.db, 'UPDATE event_members SET event_id = ? WHERE event_id = ?', into.id, from.id),
    q(c.db, 'UPDATE combatants SET event_id = ? WHERE event_id = ?', into.id, from.id),
    q(c.db, 'UPDATE events SET ended_at = ?, merged_into = ? WHERE id = ?', ts, into.id, from.id),
    q(c.db, 'UPDATE events SET merged_into = ? WHERE merged_into = ?', into.id, from.id),
    q(c.db, 'UPDATE rooms SET version = version + 1 WHERE id = ?', room.id),
  ]);
  c.evc = null;
}
// Підсумки по персонажах: шкода, лікування, усі кидки (навички, характеристики, рятівні, атаки…), інші дії
// Позначка майстра для кидка (dice_rolls.miss): 0 — немає, 1 — провал/промах (шкода не рахується), 2 — успіх
const ROLL_GROUPS = ['attack', 'skill', 'ability', 'save', 'init', 'free'];
// атака й шкода — «попадання / промах», решта кидків — «успіх / провал»
const HIT_KINDS = ['attack', 'spellattack', 'damage'];
async function setRollMark(c, room, r, m) {
  await run(c.db, 'UPDATE dice_rolls SET miss = ? WHERE id = ?', m, r.id);
  await resolvePendingRoll(c, r, m);
  const evs = r.event_id ? await activeEvents(c, room) : [];
  if (r.event_id && evs.some((e) => e.id === r.event_id)) {
    // у хроніку події (запис прив'язаний до кидка — зникне разом із ним)
    const d = JSON.parse(r.data);
    const hit = HIT_KINDS.includes(d.kind);
    const what = m === 2 ? (hit ? 'позначив попадання' : 'позначив успіх') : m === 1 ? (hit ? 'позначив промах' : 'позначив провал') : 'зняв позначку';
    const ch = await first(c.db, 'SELECT sheet FROM characters WHERE id = ?', r.char_id);
    await addLog(c, room, `${what}: ${ch ? JSON.parse(ch.sheet).name : ''} — ${d.label} (${d.total})`, undefined, r.event_id, r.id);
  } else await run(c.db, 'UPDATE rooms SET version = version + 1 WHERE id = ?', room.id);
}
async function eventStats(c, ev) {
  const rolls = (await all(c.db, 'SELECT id, char_id, ts, data, miss FROM dice_rolls WHERE event_id = ? ORDER BY id', ev.id))
    .map((r) => ({ id: r.id, charId: r.char_id, ts: r.ts, mark: r.miss || 0, ...JSON.parse(r.data) }));
  const acts = await all(c.db, 'SELECT * FROM event_acts WHERE event_id = ? ORDER BY id', ev.id);
  const mem = await all(c.db, 'SELECT char_id, joined_at, left_at FROM event_members WHERE event_id = ? ORDER BY id', ev.id);
  const ids = new Set([...mem.map((m) => m.char_id), ...rolls.map((r) => r.charId), ...acts.map((a) => a.char_id)]);
  const rows = await all(c.db, `SELECT ch.id, ch.alive, ch.sheet, u.first_name FROM characters ch LEFT JOIN users u ON u.id = ch.user_id
    WHERE ch.id IN (SELECT value FROM json_each(?)) ORDER BY ch.id`, JSON.stringify([...ids]));
  const chars = rows.map((r) => {
    const sh = JSON.parse(r.sheet);
    return { charId: r.id, name: sh.name, player: r.first_name || '', raceId: sh.raceId, raceName: sh.raceName || '', classId: sh.classId, level: sh.level,
      dealt: 0, dmgRolls: 0, misses: 0, adj: 0, rolls: 0, nat20: 0, nat1: 0, taken: 0, heal: 0, down: 0, deathS: 0, deathF: 0,
      groups: Object.fromEntries(ROLL_GROUPS.map((g) => [g, {}])), slots: {}, res: {}, items: {}, acts: [],
      spans: mem.filter((m) => m.char_id === r.id).sort((x, y) => x.joined_at - y.joined_at).reduce((acc, m) => {
        // перехід між подіями, що злилися, — один безперервний проміжок
        const last = acc[acc.length - 1];
        if (last && last[1] != null && m.joined_at - last[1] <= 60) last[1] = m.left_at;
        else acc.push([m.joined_at, m.left_at]);
        return acc;
      }, []), active: mem.some((m) => m.char_id === r.id && !m.left_at) };
  });
  const byId = new Map(chars.map((x) => [x.charId, x]));
  for (const r of rolls) {
    const x = byId.get(r.charId);
    if (!x) continue;
    x.rolls++;
    if (r.crit === 20) x.nat20++;
    if (r.crit === 1) x.nat1++;
    if (r.kind === 'damage') { x.dmgRolls++; if (r.mark === 1) x.misses++; else x.dealt += r.total; continue; }
    const g = r.kind === 'spellattack' ? 'attack' : ROLL_GROUPS.includes(r.kind) ? r.kind : 'free';
    // підпис у групі: без «Атака: », «Перевірка: », «Рятівний кидок: »; довільний кидок — за кубиками
    let name = String(r.label || '').replace(/^(Атака|Перевірка|Рятівний кидок): /, '');
    if (g === 'free') name = (r.groups || []).map((q) => `${q.n > 1 ? q.n : ''}к${q.s}`).join('+') + (r.mod ? R.fmtMod(r.mod) : '');
    if (g === 'init') name = 'Ініціатива';
    (x.groups[g][name] = x.groups[g][name] || []).push(`${r.total}${r.mark === 2 ? ' ✓' : r.mark === 1 ? ' ✗' : ''}`);
  }
  for (const a of acts) {
    const x = byId.get(a.char_id);
    if (!x) continue;
    const d = a.data ? JSON.parse(a.data) : {};
    if (a.kind === 'adj') { x.adj += a.value; x.dealt += a.value; } else if (a.kind === 'taken') x.taken += a.value;
    else if (a.kind === 'heal') x.heal += a.value;
    else if (a.kind === 'down') x.down += a.value;
    else if (a.kind === 'death_s') x.deathS += a.value;
    else if (a.kind === 'death_f') x.deathF += a.value;
    else if (a.kind === 'slot') x.slots[d.lvl] = (x.slots[d.lvl] || 0) + a.value;
    else if (a.kind === 'res') x.res[d.name] = (x.res[d.name] || 0) + a.value;
    else if (a.kind === 'item') x.items[d.name] = (x.items[d.name] || 0) + a.value;
    else if (a.kind === 'act' && d.text) x.acts.push(d.text);
  }
  return { chars, rolls };
}
// Текст звіту події (українською; перекладається мовою майстра)
async function buildEventTxt(c, room, ev, st) {
  const L = (x) => tr(c.user.lang, x);
  const loc = LOCALES[normLang(c.user.lang)];
  const tz = 'Europe/Kyiv';
  const fmt = (ts, withDate) => new Date(ts * 1000).toLocaleString(loc, withDate
    ? { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const end = ev.ended_at || now();
  // події, що перетекли в цю (рекурсивно)
  const merged = [];
  let frontier = [ev.id];
  while (frontier.length) {
    const rows = await all(c.db, 'SELECT * FROM events WHERE merged_into IN (SELECT value FROM json_each(?))', JSON.stringify(frontier));
    merged.push(...rows);
    frontier = rows.map((r) => r.id);
  }
  const start = Math.min(ev.started_at, ...merged.map((m) => m.started_at));
  const mins = Math.max(1, Math.round((end - start) / 60));
  const out = [];
  out.push(L(`DnD Companion — подія «${ev.name}»`));
  out.push(L(`${evTypeName(ev.type)} · кімната «${room.name}» (код ${room.id}) · сесія ${ev.session}`));
  out.push(L(`Початок: ${fmt(start, true)} · кінець: ${fmt(end, true)} · тривалість: ${mins} хв`));
  for (const m of merged.sort((a, b) => a.started_at - b.started_at)) {
    out.push(L(`Включає подію «${m.name}» (${evTypeName(m.type).toLowerCase()}, з ${fmt(m.started_at)})`));
  }
  const part = st.chars.map((x) => (x.spans.length ? `${x.name} (${x.spans.map(([a, b]) => `${fmt(a)}–${fmt(b || end)}`).join(', ')})` : x.name));
  if (part.length) out.push(L(`Учасники: ${part.join('; ')}`));
  // бій: скільки раундів і що сталося з ворогами
  const foes = (await combatRows(c, ev.id)).filter((r) => !r.char_id);
  if (ev.round) out.push(L(`Раундів бою: ${ev.round}`));
  if (foes.length) out.push(L(`Вороги: ${foes.map((r) => `${cbName(r)} — ${r.hp <= 0 ? 'переможений' : `${r.hp}/${r.hp_max} ХП`}`).join('; ')}`));
  out.push('', L('=== Підсумок по персонажах ==='), L('✓ — успіх або попадання, ✗ — провал або промах (позначки майстра)'));
  for (const x of st.chars) {
    const race = x.raceId === 'custom' ? x.raceName : (R.RACES[x.raceId] || {}).name || '';
    const cls = (R.CLASSES[x.classId] || {}).name || '';
    out.push('', `${x.name}${x.player ? ` (${x.player})` : ''} — ${L(race)}, ${L(cls)} ${L(`${x.level} рів.`)}`);
    const lines = [];
    const grp = (g) => Object.entries(x.groups[g]).map(([n, v]) => `${n}: ${v.join(', ')}`).join('; ');
    if (x.dealt || x.dmgRolls || x.adj) {
      const det = [`кидків шкоди: ${x.dmgRolls}`];
      if (x.misses) det.push(`промахів: ${x.misses}`);
      if (x.adj) det.push(`поправка майстра: ${R.fmtMod(x.adj)}`);
      lines.push(`Завдана шкода: ${x.dealt} (${det.join('; ')})`);
    }
    const GL = { attack: 'Атаки', skill: 'Перевірки навичок', ability: 'Перевірки характеристик', save: 'Рятівні кидки', init: 'Ініціатива', free: 'Довільні кидки' };
    for (const g of ROLL_GROUPS) {
      if (!Object.keys(x.groups[g]).length) continue;
      lines.push(g === 'init' ? `Ініціатива: ${x.groups.init['Ініціатива'].join(', ')}` : `${GL[g]}: ${grp(g)}`);
    }
    if (x.nat20 || x.nat1) lines.push(`Природних 20: ${x.nat20}; природних 1: ${x.nat1}`);
    if (x.taken || x.heal) lines.push(`Отримана шкода: ${x.taken}; лікування: ${x.heal}`);
    if (x.down) lines.push(`Впав до 0 ХП: ${x.down}`);
    if (x.deathS || x.deathF) lines.push(`Рятівні від смерті: успіхів ${x.deathS}, провалів ${x.deathF}`);
    const sl = Object.entries(x.slots).sort((a, b) => a[0] - b[0]).map(([l, n]) => `${l} коло ×${n}`);
    if (sl.length) lines.push(`Комірки заклять: ${sl.join(', ')}`);
    const rs = Object.entries(x.res).map(([n, k]) => `${n} ×${k}`);
    if (rs.length) lines.push(`Ресурси: ${rs.join(', ')}`);
    const its = Object.entries(x.items).map(([n, k]) => `${n} ×${k}`);
    if (its.length) lines.push(`Предмети: ${its.join(', ')}`);
    if (x.acts.length) lines.push(`Інші дії: ${x.acts.join('; ')}`);
    if (!lines.length) lines.push('без дій');
    for (const l of lines) out.push(`  ${L(l)}`);
  }
  out.push('', L('=== Хронологія ==='));
  const logs = await all(c.db, 'SELECT ts, actor, text FROM logs WHERE event_id = ? ORDER BY id', ev.id);
  for (const r of logs) out.push(`[${fmt(r.ts)}] ${L(r.actor)}: ${L(r.text)}`);
  if (!logs.length) out.push(L('(записів немає)'));
  return out.join('\n');
}
// Завершити активну подію кімнати й надіслати звіт майстрові
async function finishEvent(c, room, ev, { silent = false } = {}) {
  if (!ev || ev.ended_at) return { sent: false };
  await addLog(c, room, `завершив подію «${ev.name}»`, undefined, ev.id);
  const ts = now();
  await run(c.db, 'UPDATE events SET ended_at = ? WHERE id = ?', ts, ev.id);
  await run(c.db, 'UPDATE event_members SET left_at = ? WHERE event_id = ? AND left_at IS NULL', ts, ev.id);
  await run(c.db, 'UPDATE rooms SET version = version + 1 WHERE id = ?', room.id);
  c.evc = null;
  ev.ended_at = ts;
  // під час завершення сесії окремий звіт не надсилається — подія входить у підсумок сесії
  if (silent) return { sent: false, name: ev.name };
  const st = await eventStats(c, ev);
  const txt = await buildEventTxt(c, room, ev, st);
  const fname = `podiia_${ev.num}_${ev.name.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40)}.txt`;
  const r = await sendDocument(c.env, c.user.id, fname, txt, tr(c.user.lang, `📊 Подія «${ev.name}» завершена`));
  return { sent: !!r.ok, name: ev.name };
}

// ---------- Бій: ініціатива й черговість ----------
const pcInitMod = (sh) => R.initMod(sh);
const isCombat = (ev) => ev && ev.type === 'combat';
const combatRows = (c, evId) => all(c.db, 'SELECT * FROM combatants WHERE event_id = ? ORDER BY id', evId);
// порядок ходів: ініціатива ↓, потім модифікатор ↓, потім раніше доданий; хто ще не кинув — у кінці
function combatOrder(rows) {
  return rows.slice().sort((a, b) => (a.init == null) - (b.init == null) || (b.init || 0) - (a.init || 0) || b.init_mod - a.init_mod || a.id - b.id);
}
const isDown = (r) => !r.char_id && r.hp != null && r.hp <= 0;
// у бою — усі активні учасники-персонажі; нові отримують запит кинути ініціативу
async function syncPcCombatants(c, room, ev) {
  if (!isCombat(ev)) return;
  const members = (await all(c.db, 'SELECT char_id FROM event_members WHERE event_id = ? AND left_at IS NULL', ev.id)).map((r) => r.char_id);
  const rows = await combatRows(c, ev.id);
  for (const r of rows.filter((x) => x.char_id && !members.includes(x.char_id))) await removeCombatant(c, room, ev, r);
  for (const id of members) {
    if (rows.some((x) => x.char_id === id)) continue;
    const ch = await first(c.db, 'SELECT id, user_id, sheet FROM characters WHERE id = ?', id);
    if (!ch) continue;
    const sh = JSON.parse(ch.sheet);
    await run(c.db, 'INSERT INTO combatants (event_id, char_id, name, init_mod, created_at) VALUES (?, ?, ?, ?, ?)', ev.id, id, sh.name, pcInitMod(sh), now());
    notify(c, ch.user_id, `⚔️ Бій «${ev.name}»! Кинь ініціативу в застосунку.`);
  }
}
async function removeCombatant(c, room, ev, r) {
  if (ev.turn_id === r.id) await advanceTurn(c, room, ev, 1, r.id);
  await run(c.db, 'DELETE FROM combatants WHERE id = ?', r.id);
}
// ефекти в раундах зменшуються на початку ходу персонажа
async function turnStartEffects(c, room, charId) {
  for (const fx of await all(c.db, "SELECT * FROM char_effects WHERE char_id = ? AND unit = 'round'", charId)) {
    if (fx.n - 1 > 0) { await run(c.db, 'UPDATE char_effects SET n = ? WHERE id = ?', fx.n - 1, fx.id); continue; }
    await run(c.db, 'DELETE FROM char_effects WHERE id = ?', fx.id);
    await addLog(c, room, `ефект «${JSON.parse(fx.data).name}» на ${await charName(c, charId)} закінчився`);
  }
}
const cbName = (r) => (r.num ? `${r.name} ${r.num}` : r.name);
// стан ходу (див. R.TURN_BLANK): витрачені дія / бонусна дія / реакція / дія прискорення, атаки, що лишились,
// pending — дія, що чекає кидка й рішення майстра, dmg — влучили, гравець кидає шкоду, last — чим закінчилась остання
const turnOf = (r) => R.turnState(r.turn ? JSON.parse(r.turn) : null);
const noPrev = (p) => { if (!p) return null; const { prev, refund, ...x } = p; return x; };
const turnPublic = (t) => ({ ...t, pending: noPrev(t.pending), dmg: noPrev(t.dmg), last: noPrev(t.last) });
const saveTurn = (c, id, t) => run(c.db, 'UPDATE combatants SET turn = ? WHERE id = ?', JSON.stringify(t), id);
// учасник бою — персонаж ch (у будь-чий хід); isTurn — чи зараз його хід
async function combatRowOf(c, room, ch) {
  const evId = await charEventId(c, ch.id);
  const ev = evId && (await first(c.db, 'SELECT * FROM events WHERE id = ? AND room_id = ? AND ended_at IS NULL', evId, room.id));
  if (!ev || !ev.round) return null;
  const row = await first(c.db, 'SELECT * FROM combatants WHERE event_id = ? AND char_id = ?', ev.id, ch.id);
  return row ? { ev, cur: row, isTurn: ev.turn_id === row.id } : null;
}
// зброя персонажа для правил бою (стара зброя без шкоди — з каталогу)
async function charWeaponsSrv(c, charId, sheet) {
  return (await all(c.db, 'SELECT id, data, qty FROM items WHERE char_id = ?', charId)).map((it) => {
    let d = JSON.parse(it.data);
    if (d.type === 'weapon' && !d.damage && d.catalogId && CATALOG_BY_ID[d.catalogId]) {
      const b = CATALOG_BY_ID[d.catalogId];
      d = { ...d, damage: b.damage, dmgType: b.dmgType, props: d.props || b.props, ranged: b.ranged, cat: d.cat || b.cat };
    }
    return { id: it.id, d, qty: it.qty };
  }).filter((w) => w.d.type === 'weapon' || (['staff', 'rod'].includes(w.d.type) && w.d.damage)).concat(R.naturalWeapons(sheet || {}));
}
// накласти ефект на персонажа (той самий стандартний не дублюється — оновлюється тривалість)
async function putEffect(c, room, ch, key, n, unit, data) {
  const def = key ? R.EFFECTS[key] : null;
  if (!data) data = { name: def.name, icon: def.icon };
  const d = fxDuration(n, unit, def);
  const ex = key ? await first(c.db, 'SELECT id FROM char_effects WHERE char_id = ? AND key = ?', ch.id, key) : null;
  let id;
  if (ex) {
    await run(c.db, 'UPDATE char_effects SET n = ?, unit = ? WHERE id = ?', d.n, d.unit, ex.id);
    id = ex.id;
  } else {
    const cnt = await first(c.db, 'SELECT COUNT(*) AS n FROM char_effects WHERE char_id = ?', ch.id);
    if (cnt.n >= MAX_CHAR_EFFECTS) fail('На персонажі забагато ефектів — зніми зайві');
    const r = await run(c.db, 'INSERT INTO char_effects (char_id, room_id, key, data, n, unit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ch.id, room.id, key || null, JSON.stringify(data), d.n, d.unit, now());
    id = r.meta && r.meta.last_row_id;
  }
  return { id, d };
}
const CB_ACTS_SRV = { dash: '🏃 Ривок', dodge: '🛡️ Ухилення', disengage: '↩️ Відхід', help: '🤝 Допомога', hide: '🫥 Сховатися', ready: '⏳ Підготовка', search: '🔎 Пошук', object: '🖐️ Використати об’єкт', move: '👣 Переміщення' };
const resLeft = (s) => Object.fromEntries(R.sheetResources(s).map((r) => [r.id, r.max - r.used]));
// витрата за обраною ціною; attack — атака чи захоплення з дії «Атака»
function spendTurn(t, cost, { attack = false, apa = 1, lim = {} } = {}) {
  const w = R.turnCostLeft(t, cost, lim, attack ? 'attack' : '');
  if (w) fail(w);
  if (cost === 'bonus') t.bonus = 1;
  else if (cost === 'reaction') t.reaction = 1;
  else if (cost === 'haste') t.haste = 1;
  else if (cost === 'action') {
    if (attack && t.attacks > 0) t.attacks -= 1;
    else {
      t.action = 1;
      if (attack) t.attacks = lim.slow ? 0 : Math.max(0, apa - 1);
    }
  }
}
// використання ресурсів класу (очки ці, чародійства…); n < 0 — повернути
async function spendRes(c, room, ch, extra, sign = 1) {
  if (!extra) return;
  const s = ch.sheet;
  const all0 = R.sheetResources(s);
  s.resUsed = { ...(s.resUsed || {}) };
  for (const [id, n] of Object.entries(extra)) {
    const r = all0.find((x) => x.id === id);
    if (!r) fail('Невідомий ресурс');
    const used = Math.max(0, Math.min(r.max, r.used + sign * n));
    if (sign > 0 && r.max - r.used < n) fail(`Не вистачає: ${r.name}`);
    s.resUsed[id] = used;
    if (sign > 0) await evAct(c, room, ch, 'res', n, { name: r.name });
  }
  await saveSheet(c, ch);
}
// рішення майстра по кидку, що чекав: попадання → кидок шкоди, промах чи перевірка → назад до меню дій
// учасник бою, у ході якого записано цей кидок
async function turnRowOfRoll(c, r) {
  const rows = await all(c.db, 'SELECT * FROM combatants WHERE char_id = ? AND turn IS NOT NULL ORDER BY id DESC LIMIT 5', r.char_id);
  return rows.find((x) => { const t = turnOf(x); return [t.pending, t.dmg, t.last].some((p) => p && p.rollId === r.id); });
}
// майстер видалив кидок, що чекав рішення: дія знову чекає кидка
async function forgetPendingRoll(c, r) {
  const row = await turnRowOfRoll(c, r);
  if (!row) return;
  const t = turnOf(row);
  const p = (t.pending && t.pending.rollId === r.id && t.pending) || (t.dmg && t.dmg.rollId === r.id && t.dmg);
  if (!p) return;
  const { rollId, total, crit, label, ...rest } = p;
  t.pending = rest;
  t.dmg = null;
  delete t.pending.crit;
  await saveTurn(c, row.id, t);
}
async function resolvePendingRoll(c, r, m) {
  const row = await turnRowOfRoll(c, r);
  if (!row) return;
  const t = turnOf(row);
  if (t.pending && t.pending.rollId === r.id) {
    if (!m) return;
    const p = t.pending;
    t.pending = null;
    if (m === 2 && (p.kind === 'attack' || p.kind === 'spellattack')) t.dmg = { ...p, crit: p.crit === 20 };
    else t.last = { ...p, result: m };
    // «Майстер великої зброї»: крит зброєю ближнього бою у свій хід відкриває бонусну атаку
    if (m === 2 && p.kind === 'attack' && p.melee && p.crit === 20) {
      const ev = await first(c.db, 'SELECT turn_id FROM events WHERE id = ?', row.event_id);
      if (ev && ev.turn_id === row.id) t.gwm = 1;
    }
  } else if (t.dmg && t.dmg.rollId === r.id) {
    // передумав: промах або зняв позначку
    const p = t.dmg;
    t.dmg = null;
    if (m === 1) t.last = { ...p, result: 1 }; else if (!m) t.pending = p;
  } else if (t.last && t.last.rollId === r.id && t.last.dmgTotal == null && !t.pending && !t.dmg) {
    const p = { ...t.last };
    delete p.result;
    t.last = null;
    if (m === 2 && (p.kind === 'attack' || p.kind === 'spellattack')) t.dmg = { ...p, crit: p.crit === 20 };
    else if (m) t.last = { ...p, result: m }; else t.pending = p;
  } else return;
  await saveTurn(c, row.id, t);
}
// перехід ходу: dir 1 — далі (новий раунд після останнього), −1 — назад; skipId — той, кого зараз прибирають
async function advanceTurn(c, room, ev, dir, skipId) {
  const order = combatOrder(await combatRows(c, ev.id)).filter((r) => r.init != null && r.id !== skipId && !isDown(r));
  if (!order.length) {
    await run(c.db, 'UPDATE events SET turn_id = NULL WHERE id = ?', ev.id);
    ev.turn_id = null;
    return null;
  }
  const all0 = combatOrder(await combatRows(c, ev.id)).filter((r) => r.init != null);
  let idx = all0.findIndex((r) => r.id === ev.turn_id);
  let round = ev.round || 1;
  let next = null;
  for (let step = 0; step < all0.length + 1; step++) {
    idx += dir;
    if (idx >= all0.length) { idx = 0; round += 1; }
    if (idx < 0) { idx = all0.length - 1; round = Math.max(1, round - 1); }
    const cand = all0[idx];
    if (cand && cand.id !== skipId && !isDown(cand)) { next = cand; break; }
  }
  if (!next) next = order[0];
  await run(c.db, 'UPDATE events SET turn_id = ?, round = ? WHERE id = ?', next.id, round, ev.id);
  if (dir > 0) await run(c.db, 'UPDATE combatants SET turn = NULL WHERE id = ?', next.id);
  const newRound = round !== ev.round;
  ev.turn_id = next.id;
  ev.round = round;
  await addLog(c, room, `${newRound ? `⚔️ Раунд ${round}. ` : ''}Хід: ${cbName(next)}`, undefined, ev.id);
  if (dir > 0 && next.char_id) await turnStartEffects(c, room, next.char_id);
  return next;
}
const MON_STATE = (r) => (r.hp <= 0 ? 'dead' : r.hp >= r.hp_max ? 'ok' : r.hp > r.hp_max / 2 ? 'hurt' : r.hp > r.hp_max / 4 ? 'bad' : 'near');
// стан бою для клієнта: майстрові — усе, гравцям — вороги без ХП і КЗ (лише стан словами)
async function combatView(c, ev, forMaster) {
  const rows = combatOrder(await combatRows(c, ev.id));
  if (!isCombat(ev) && !rows.length) return null;
  const pcIds = rows.filter((r) => r.char_id).map((r) => r.char_id);
  const pcs = pcIds.length ? await all(c.db, `SELECT id, json_extract(sheet, '$.hp.cur') AS hp, json_extract(sheet, '$.hp.max') AS hpMax, json_extract(sheet, '$.classId') AS cls
    FROM characters WHERE id IN (SELECT value FROM json_each(?))`, JSON.stringify(pcIds)) : [];
  const list = rows.map((r) => {
    if (r.char_id) {
      const p = pcs.find((x) => x.id === r.char_id) || {};
      const t = turnOf(r);
      return { id: r.id, kind: 'pc', charId: r.char_id, name: r.name, init: r.init, initMod: r.init_mod, hp: p.hp, hpMax: p.hpMax, classId: p.cls || '',
        turn: turnPublic(t) };
    }
    const base = { id: r.id, kind: 'npc', mon: r.mon, name: r.name, num: r.num, init: r.init, state: MON_STATE(r), icon: r.data ? JSON.parse(r.data).icon || null : null };
    if (!forMaster) return base;
    return { ...base, initMod: r.init_mod, hp: r.hp, hpMax: r.hp_max, ac: r.ac, data: r.data ? JSON.parse(r.data) : null };
  });
  return { round: ev.round || 0, turnId: ev.turn_id || null, list };
}
// ворог із бестіарію (b:ключ) або свій (m:id)
async function monsterSource(c, mon) {
  const [kind, key] = String(mon || '').split(':');
  if (kind === 'b' && MONSTERS[key]) {
    const m = MONSTERS[key];
    return { mon: `b:${key}`, name: m.n[0], hp: m.hp, ac: m.ac, initMod: monInit(m), data: null };
  }
  if (kind === 'm') {
    const r = await first(c.db, 'SELECT data FROM master_monsters WHERE id = ? AND owner_id = ?', int(key, 0, 1e12, 0), c.user.id);
    if (!r) fail('Ворога не знайдено у твоєму бестіарії');
    const d = JSON.parse(r.data);
    return { mon: `m:${key}`, name: d.name, hp: d.hp, ac: d.ac, initMod: R.mod(d.ab[1]), data: d };
  }
  fail('Ворога не знайдено');
}
function sanitizeMonster(m) {
  m = m && typeof m === 'object' ? m : {};
  const name = str(m.name, 60).trim();
  if (!name) fail('Вкажи назву ворога');
  const ab = Array.from({ length: 6 }, (_, i) => int((m.ab || [])[i], 1, 30, 10));
  return { name, icon: [...str(m.icon, 16).trim()].slice(0, 4).join('') || '👹', t: str(m.t, 20), cr: str(m.cr, 6) || '1',
    ac: int(m.ac, 1, 40, 12), hp: int(m.hp, 1, 9999, 10), sp: str(m.sp, 80).trim(), ab,
    acts: str(m.acts, 2000).trim(), desc: str(m.desc, 3000).trim() };
}
async function combatEvent(c, roomId, eventId) {
  const room = await requireMaster(c, roomId);
  const evs = await activeEvents(c, room);
  const ev = evs.find((e) => e.id === int(eventId, 0, 1e12, 0));
  if (!ev) fail('Подію не знайдено або вже завершено');
  return { room, ev };
}
async function combatantOf(c, roomId, id) {
  const r = await first(c.db, 'SELECT * FROM combatants WHERE id = ?', int(id, 0, 1e12, 0));
  if (!r) fail('Учасника бою не знайдено');
  const { room, ev } = await combatEvent(c, roomId, r.event_id);
  return { room, ev, r };
}

// ---------- Підсумок сесії ----------
// Стан персонажа: рівень, досвід, гроші, ХП, натхнення, предмети (назва → кількість)
async function charState(c, row) {
  const sh = typeof row.sheet === 'string' ? JSON.parse(row.sheet) : row.sheet;
  const items = {};
  for (const it of await all(c.db, 'SELECT data, qty FROM items WHERE char_id = ? ORDER BY id', row.id)) {
    const n = JSON.parse(it.data).name || '?';
    items[n] = (items[n] || 0) + it.qty;
  }
  const money = {};
  for (const k of R.COINS) if (sh.money && sh.money[k]) money[k] = sh.money[k];
  return { level: sh.level, xp: sh.xp || 0, money, hp: [sh.hp ? sh.hp.cur : 0, sh.hp ? sh.hp.max : 0], insp: R.inspCount(sh), items };
}
async function snapChar(c, room, row, extra) {
  const st = await charState(c, row);
  await run(c.db, 'INSERT OR IGNORE INTO char_snaps (char_id, session, room_id, ts, data) VALUES (?, ?, ?, ?, ?)',
    row.id, room.session, room.id, now(), JSON.stringify(extra ? { ...st, ...extra } : st));
}
// Знімок «на початку сесії» для кожного живого персонажа кімнати, якого ще немає
async function ensureSnaps(c, room) {
  const rows = await all(c.db, `SELECT ch.id, ch.sheet FROM characters ch WHERE ch.room_id = ? AND ch.alive = 1
    AND NOT EXISTS (SELECT 1 FROM char_snaps s WHERE s.char_id = ch.id AND s.session = ?)`, room.id, room.session);
  for (const r of rows) await snapChar(c, room, r);
}
// Позначка в знімку сесії: died / revived
async function snapMark(c, room, charId, key) {
  await run(c.db, `UPDATE char_snaps SET data = json_set(data, '$.${key}', COALESCE(json_extract(data, '$.${key}'), 0) + 1) WHERE char_id = ? AND session = ?`, charId, room.session);
}
async function buildSessionSummary(c, room) {
  const ts = now();
  await ensureSnaps(c, room);
  const snaps = await all(c.db, 'SELECT * FROM char_snaps WHERE room_id = ? AND session = ? ORDER BY char_id', room.id, room.session);
  const chars = [];
  for (const sn of snaps) {
    const row = await first(c.db, 'SELECT ch.id, ch.alive, ch.sheet, u.first_name FROM characters ch LEFT JOIN users u ON u.id = ch.user_id WHERE ch.id = ?', sn.char_id);
    if (!row) continue;
    const a = JSON.parse(sn.data);
    const sh = JSON.parse(row.sheet);
    chars.push({ id: row.id, name: sh.name, player: row.first_name || '', raceId: sh.raceId, raceName: sh.raceName || '', classId: sh.classId,
      alive: !!row.alive, created: !!a.created, died: a.died || 0, revived: a.revived || 0,
      start: { level: a.level, xp: a.xp, money: a.money || {}, insp: a.insp || 0, items: a.items || {} }, end: await charState(c, row) });
  }
  // події сесії; ті, що перетекли в іншу, — всередині неї
  const evs = await all(c.db, 'SELECT * FROM events WHERE room_id = ? AND session = ? ORDER BY started_at, id', room.id, room.session);
  const events = [];
  for (const ev of evs.filter((e) => !e.merged_into)) {
    const parts = evs.filter((e) => e.merged_into === ev.id);
    const names = (await all(c.db, `SELECT ch.sheet FROM characters ch WHERE ch.id IN (SELECT DISTINCT char_id FROM event_members WHERE event_id = ?) ORDER BY ch.id`, ev.id))
      .map((r) => JSON.parse(r.sheet).name);
    events.push({ name: ev.name, type: ev.type, start: Math.min(ev.started_at, ...parts.map((p) => p.started_at)), end: ev.ended_at || ts,
      merged: parts.map((p) => ({ name: p.name, type: p.type, start: p.started_at })), members: names });
  }
  const fl = await first(c.db, 'SELECT MIN(ts) AS t FROM logs WHERE room_id = ? AND session = ?', room.id, room.session);
  return { v: 1, session: room.session, start: (fl && fl.t) || ts, end: ts, chars, events };
}
// Текст підсумку мовою користувача (рядки)
function renderSummary(lang, room, sm) {
  const L = (x) => tr(lang, x);
  const loc = LOCALES[normLang(lang)];
  const tz = 'Europe/Kyiv';
  const fmt = (t, withDate) => new Date(t * 1000).toLocaleString(loc, withDate
    ? { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const ms = (m) => R.COINS.filter((k) => m[k]).map((k) => `${m[k]} ${R.COIN_NAMES[k]}`).join(', ') || `0 ${R.COIN_NAMES.gp}`;
  const mins = Math.max(1, Math.round((sm.end - sm.start) / 60));
  const dur = mins >= 60 ? L(`${Math.floor(mins / 60)} год ${mins % 60} хв`) : L(`${mins} хв`);
  const out = [];
  out.push(L(`DnD Companion — підсумок сесії ${sm.session}`));
  out.push(L(`Кімната «${room.name}» (код ${room.id})`));
  out.push(L(`Початок: ${fmt(sm.start, true)} · кінець: ${fmt(sm.end, true)} · тривалість: ${dur}`));
  out.push('', L('=== Персонажі ==='));
  if (!sm.chars.length) out.push(L('(персонажів немає)'));
  for (const x of sm.chars) {
    const race = x.raceId === 'custom' ? x.raceName : (R.RACES[x.raceId] || {}).name || '';
    const cls = (R.CLASSES[x.classId] || {}).name || '';
    out.push('', `${x.name}${x.player ? ` (${x.player})` : ''} — ${L(race)}, ${L(cls)}`);
    const a = x.start;
    const b = x.end;
    const lines = [];
    if (x.created) lines.push('🆕 Новий персонаж — створено в цій сесії');
    if (x.died) lines.push('☠ Загинув у цій сесії');
    if (x.revived) lines.push('✨ Повернений до життя');
    lines.push(a.level === b.level ? `Рівень: ${b.level}` : a.level < b.level ? `Рівень: підвищення рівня ${a.level}–${b.level}` : `Рівень: ${a.level} → ${b.level}`);
    lines.push(a.xp === b.xp ? `Досвід: ${b.xp}` : `Досвід: ${a.xp} → ${b.xp}`);
    const same = R.COINS.every((k) => (a.money[k] || 0) === (b.money[k] || 0));
    lines.push(same ? `Гроші: ${ms(b.money)}` : `Гроші: почав з ${ms(a.money)} — на кінець сесії має ${ms(b.money)}`);
    const names = [...new Set([...Object.keys(a.items), ...Object.keys(b.items)])];
    const iq = (n, q) => `${L(n)}${q > 1 ? ` ×${q}` : ''}`;
    const got = names.filter((n) => (b.items[n] || 0) > (a.items[n] || 0)).map((n) => iq(n, (b.items[n] || 0) - (a.items[n] || 0)));
    const lost = names.filter((n) => (a.items[n] || 0) > (b.items[n] || 0)).map((n) => iq(n, (a.items[n] || 0) - (b.items[n] || 0)));
    if (got.length) lines.push(`Отримав предмети: ${got.join(', ')}`);
    if (lost.length) lines.push(`Втратив або використав: ${lost.join(', ')}`);
    if (!got.length && !lost.length) lines.push('Предмети: без змін');
    lines.push(`ХП: ${b.hp[0]}/${b.hp[1]}`);
    if (a.insp !== b.insp) lines.push(`Натхнення: ${a.insp} → ${b.insp}`);
    else if (b.insp) lines.push(`Натхнення: ${b.insp}`);
    for (const l of lines) out.push(`  ${L(l)}`);
  }
  if (sm.events.length) {
    out.push('', L('=== Події сесії ==='));
    for (const ev of sm.events) {
      const [tn, ti] = R.EVENT_TYPES[ev.type] || R.EVENT_TYPES.other;
      // назва за замовчуванням («Подія 2») перекладається, назву майстра — як є
      out.push('', `${ti} ${/^Подія \d+$/.test(ev.name) ? L(ev.name) : ev.name} — ${L(tn).toLowerCase()}, ${fmt(ev.start)}–${fmt(ev.end)}`);
      for (const m of ev.merged) out.push(`  ${L(`Включає подію «${m.name}» (${evTypeName(m.type).toLowerCase()}, з ${fmt(m.start)})`)}`);
      if (ev.members.length) out.push(`  ${L(`Учасники: ${ev.members.join(', ')}`)}`);
    }
  }
  return out;
}
async function roomSummaries(c, room) {
  return (await all(c.db, 'SELECT * FROM session_summaries WHERE room_id = ? ORDER BY session', room.id)).map((r) => ({ id: r.id, session: r.session, ts: r.ts, data: JSON.parse(r.data) }));
}

// ---------- Досвід і рівні від майстра ----------
async function giveXp(c, ch, n) {
  const s = ch.sheet;
  s.xp = Math.max(0, (s.xp || 0) + n);
  const before = s.targetLevel;
  const byXp = R.levelForXp(s.xp);
  if (byXp > s.targetLevel) s.targetLevel = Math.min(20, byXp);
  await saveSheet(c, ch);
  let msg = `⭐ Майстер нарахував ${n > 0 ? '+' : ''}${n} досвіду. Всього: ${s.xp}.`;
  if (s.targetLevel > before && s.targetLevel > s.level) msg += `\n⬆️ Доступне підвищення до ${s.targetLevel} рівня! Відкрий застосунок.`;
  notify(c, ch.userId, msg);
}
// дозвіл на наступний рівень; досвід підтягується до порогу цього рівня (смужка досвіду не показує «1 / 300»)
async function giveLevel(c, ch) {
  const s = ch.sheet;
  const cur = Math.max(s.targetLevel, s.level);
  if (cur >= 20) return false;
  s.targetLevel = cur + 1;
  s.xp = Math.max(s.xp || 0, R.XP_TABLE[s.targetLevel - 1] || 0);
  await saveSheet(c, ch);
  notify(c, ch.userId, `⬆️ Майстер дозволив підвищити рівень ${s.name} до ${s.targetLevel}! Відкрий застосунок, щоб пройти підвищення.`);
  return true;
}
// обрані майстром живі персонажі його кімнати
async function masterPicks(c, roomId, charIds) {
  const room = await requireMaster(c, roomId);
  const ids = [...new Set((Array.isArray(charIds) ? charIds : []).slice(0, 50).map((x) => int(x, 0, 1e12, 0)))];
  const chars = [];
  for (const id of ids) {
    const row = await first(c.db, 'SELECT * FROM characters WHERE id = ? AND room_id = ? AND alive = 1', id, room.id);
    if (row) chars.push(parseChar(row));
  }
  if (!chars.length) fail('Обери хоча б одного персонажа');
  return { room, chars };
}

const OPS = {
  async me(c) {
    const u = c.user;
    const masterRooms = await all(c.db, `SELECT r.id, r.name, r.session, r.created_at AS createdAt,
      (SELECT COUNT(*) FROM members m WHERE m.room_id = r.id) AS players
      FROM rooms r WHERE r.master_id = ? AND r.deleted = 0 ORDER BY r.created_at DESC`, u.id);
    const pr = await all(c.db, `SELECT r.id, r.name, mu.first_name AS masterName,
      (SELECT sheet FROM characters ch WHERE ch.room_id = r.id AND ch.user_id = ? AND ch.alive = 1 ORDER BY ch.id DESC LIMIT 1) AS sheet
      FROM members m JOIN rooms r ON r.id = m.room_id LEFT JOIN users mu ON mu.id = r.master_id
      WHERE m.user_id = ? AND r.deleted = 0 ORDER BY m.joined_at DESC`, u.id, u.id);
    const playerRooms = pr.map((r) => {
      const s = r.sheet ? JSON.parse(r.sheet) : null;
      return { id: r.id, name: r.name, masterName: r.masterName, character: s ? { name: s.name, classId: s.classId, level: s.level, pendingLevel: s.targetLevel > s.level } : null };
    });
    const archive = (await archiveRows(c)).map(({ sheet, items, ...rest }) => rest);
    return { user: u, botUsername: await botUsername(c.env), masterRooms, playerRooms, archive, maxPlayers: MAX_PLAYERS };
  },

  // Архів: усі персонажі гравця за весь час (лише перегляд)
  async archiveChar(c, { charId }) {
    const row = (await archiveRows(c, int(charId, 0, 1e12, 0)))[0];
    if (!row) fail('Персонажа не знайдено в архіві');
    const ch = parseChar(await first(c.db, 'SELECT * FROM characters WHERE id = ?', row.id));
    ch.items = await loadItems(c, [ch.id]);
    return { character: ch, info: { roomName: row.roomName, roomId: row.roomId, status: row.status, dead: row.dead, createdAt: row.createdAt } };
  },

  async setLang(c, { lang }) {
    if (!['uk', 'ru', 'en'].includes(lang)) fail('Невідома дія');
    await run(c.db, 'UPDATE users SET lang = ? WHERE id = ?', lang, c.user.id);
    if (c.user.lang !== lang && c.env.BOT_TOKEN) {
      const p = menuButton(c.env, c.user.id, lang).catch(() => {});
      if (c.ctx && c.ctx.waitUntil) c.ctx.waitUntil(p);
    }
    c.user.lang = lang;
    return { ok: true, lang };
  },

  async setRole(c, { role }) {
    if (!['master', 'player'].includes(role)) fail('Невідома роль');
    await run(c.db, 'UPDATE users SET role = ? WHERE id = ?', role, c.user.id);
    return { ok: true };
  },

  async createRoom(c, { name, maxStartLevel }) {
    name = str(name, 60);
    const maxLv = int(maxStartLevel, 1, 20, 1);
    if (!name) fail('Вкажіть назву кімнати');
    let id;
    for (let i = 0; i < 10; i++) {
      id = roomCode();
      if (!(await first(c.db, 'SELECT 1 AS x FROM rooms WHERE id = ?', id))) break;
    }
    await run(c.db, 'INSERT INTO rooms (id, name, master_id, session, created_at, deleted, max_start_level) VALUES (?, ?, ?, 1, ?, 0, ?)', id, name, c.user.id, now(), maxLv);
    const room = await getRoom(c, id);
    await addLog(c, room, `створив кімнату «${name}»${maxLv > 1 ? ` (початковий рівень персонажів до ${maxLv})` : ''}`);
    return { room: { id, name } };
  },

  async renameRoom(c, { roomId, name }) {
    const room = await requireMaster(c, roomId);
    name = str(name, 60);
    if (!name) fail('Вкажіть назву кімнати');
    await run(c.db, 'UPDATE rooms SET name = ? WHERE id = ?', name, room.id);
    await addLog(c, room, `перейменував кімнату: «${room.name}» → «${name}»`);
  },

  async setRoomOptions(c, { roomId, maxStartLevel }) {
    const room = await requireMaster(c, roomId);
    const maxLv = int(maxStartLevel, 1, 20, 1);
    if (maxLv === (room.max_start_level || 1)) return { maxStartLevel: maxLv };
    await run(c.db, 'UPDATE rooms SET max_start_level = ? WHERE id = ?', maxLv, room.id);
    await addLog(c, room, maxLv > 1 ? `дозволив створювати персонажів до ${maxLv} рівня` : 'персонажі тепер починають з 1 рівня');
    return { maxStartLevel: maxLv };
  },

  async deleteRoom(c, { roomId, message }) {
    const room = await requireMaster(c, roomId);
    const text = str(message, 1500);
    if (!text) fail('Напиши останнє повідомлення гравцям');
    await addLog(c, room, `закрив кімнату. Останнє слово: ${text}`);
    await run(c.db, 'UPDATE rooms SET deleted = 1, version = version + 1 WHERE id = ?', room.id);
    const members = await all(c.db, 'SELECT user_id FROM members WHERE room_id = ?', room.id);
    for (const m of members) notify(c, m.user_id, `📜 Останнє слово майстра · «${room.name}»\n\n${text}`);
  },

  async joinRoom(c, { code }) {
    code = str(code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) fail('Введи код кімнати');
    const room = await first(c.db, 'SELECT * FROM rooms WHERE id = ? AND deleted = 0', code);
    if (!room) fail('Кімнату з таким кодом не знайдено');
    if (room.master_id === c.user.id) fail('Ти майстер цієї кімнати — стати в ній гравцем не можна');
    if (await isMember(c, room.id)) return { room: { id: room.id, name: room.name }, already: true };
    const cnt = await first(c.db, 'SELECT COUNT(*) AS n FROM members WHERE room_id = ?', room.id);
    if (cnt.n >= MAX_PLAYERS) fail(`Кімната заповнена (максимум ${MAX_PLAYERS} гравців)`);
    await run(c.db, 'INSERT INTO members (room_id, user_id, joined_at) VALUES (?, ?, ?)', room.id, c.user.id, now());
    await addLog(c, room, 'приєднався до кімнати');
    notify(c, room.master_id, `👋 ${c.user.name} приєднався до кімнати «${room.name}».`);
    return { room: { id: room.id, name: room.name } };
  },

  async leaveRoom(c, { roomId }) {
    const room = await getRoom(c, roomId);
    if (!(await isMember(c, room.id))) return;
    await run(c.db, 'DELETE FROM members WHERE room_id = ? AND user_id = ?', room.id, c.user.id);
    await addLog(c, room, 'покинув кімнату');
    notify(c, room.master_id, `🚶 ${c.user.name} покинув кімнату «${room.name}».`);
  },

  async kick(c, { roomId, userId }) {
    const room = await requireMaster(c, roomId);
    const uid = int(userId, 0, 1e15, 0);
    const u = await first(c.db, 'SELECT first_name FROM users WHERE id = ?', uid);
    await run(c.db, 'DELETE FROM members WHERE room_id = ? AND user_id = ?', room.id, uid);
    await addLog(c, room, `видалив гравця ${u ? u.first_name : uid} з кімнати`);
    notify(c, uid, `🚪 Майстер видалив тебе з кімнати «${room.name}».`);
  },

  async room(c, { roomId, rolls }) {
    const room = await getRoom(c, roomId);
    const master = await first(c.db, 'SELECT first_name FROM users WHERE id = ?', room.master_id);
    const base = { id: room.id, name: room.name, session: room.session, version: room.version || 0, maxStartLevel: room.max_start_level || 1, masterName: master ? master.first_name : '' };
    const evs = await activeEvents(c, room);
    await ensureSnaps(c, room);
    const evBrief = (ev) => ({ id: ev.id, name: ev.name, type: ev.type, startedAt: ev.started_at, members: ev.members });
    if (room.master_id === c.user.id) {
      const members = await all(c.db, `SELECT m.user_id, m.joined_at, m.help_req, m.last_roll, u.first_name, u.username FROM members m
        LEFT JOIN users u ON u.id = m.user_id WHERE m.room_id = ? ORDER BY m.joined_at`, room.id);
      const chars = (await all(c.db, 'SELECT * FROM characters WHERE room_id = ? ORDER BY id', room.id)).map(parseChar);
      const alive = chars.filter((ch) => ch.alive);
      const items = await loadItems(c, alive.map((ch) => ch.id));
      for (const ch of alive) ch.items = items.filter((it) => it.charId === ch.id);
      const fxs = await loadEffects(c, alive.map((ch) => ch.id));
      for (const ch of alive) ch.effects = fxs.filter((e) => e.charId === ch.id);
      const players = members.map((m) => {
        const character = alive.filter((ch) => ch.userId === m.user_id).pop() || null;
        const helpRequested = !character && !!m.help_req;
        // кидок характеристик гравця потрібен майстрові, щоб створити персонажа за нього
        return { userId: m.user_id, name: m.first_name, username: m.username, joinedAt: m.joined_at, character, helpRequested,
          lastRoll: helpRequested && m.last_roll ? JSON.parse(m.last_roll) : null };
      });
      const fallen = chars.filter((ch) => !ch.alive).map((ch) => ({ id: ch.id, userId: ch.userId, name: ch.sheet.name, level: ch.sheet.level, classId: ch.sheet.classId }));
      // живі підсумки кожної активної події: учасники, кидки (з позначками майстра)
      // стрічка кидків гравців поточної сесії (лише коли майстер відкрив вкладку 🎲) + найновіший кидок для позначки «є нові»
      const lr = await first(c.db, 'SELECT MAX(id) AS m FROM dice_rolls WHERE room_id = ? AND session = ?', room.id, room.session);
      base.lastRollId = (lr && lr.m) || 0;
      const lim = int(rolls, 0, 500, 0);
      if (lim) {
        base.rolls = (await all(c.db, `SELECT d.id, d.char_id, d.ts, d.data, d.miss, d.event_id, json_extract(ch.sheet, '$.name') AS cname,
            json_extract(ch.sheet, '$.classId') AS cls, json_extract(ch.sheet, '$.subclassId') AS sub, u.first_name, e.name AS ev_name, e.type AS ev_type
          FROM dice_rolls d JOIN characters ch ON ch.id = d.char_id LEFT JOIN users u ON u.id = ch.user_id LEFT JOIN events e ON e.id = d.event_id
          WHERE d.room_id = ? AND d.session = ? ORDER BY d.id DESC LIMIT ?`, room.id, room.session, lim))
          .map((r) => ({ id: r.id, charId: r.char_id, ts: r.ts, mark: r.miss || 0, charName: r.cname || '', classId: r.cls || '', subclassId: r.sub || '',
            player: r.first_name || '', ev: r.ev_name ? { name: r.ev_name, type: r.ev_type } : null, ...JSON.parse(r.data) }));
      }
      base.events = [];
      for (const ev of evs) {
        const st = await eventStats(c, ev);
        base.events.push({ ...evBrief(ev), combat: await combatView(c, ev, true),
          chars: st.chars.filter((x) => x.active).map((x) => ({ charId: x.charId, name: x.name, dealt: x.dealt, taken: x.taken, heal: x.heal, rolls: x.rolls, misses: x.misses, adj: x.adj, acts: x.acts.length })),
          rolls: st.rolls.slice(-40).reverse()
            .map((r) => ({ id: r.id, charId: r.charId, kind: r.kind, label: r.label, total: r.total, mark: r.mark, crit: r.crit, ts: r.ts, name: (st.chars.find((x) => x.charId === r.charId) || {}).name || '' })) });
      }
      return { role: 'master', room: base, players, fallen, maxPlayers: MAX_PLAYERS };
    }
    const mem = await first(c.db, 'SELECT * FROM members WHERE room_id = ? AND user_id = ?', room.id, c.user.id);
    if (!mem) fail('Ти не в цій кімнаті. Приєднайся за кодом.');
    const row = await first(c.db, 'SELECT * FROM characters WHERE room_id = ? AND user_id = ? AND alive = 1 ORDER BY id DESC LIMIT 1', room.id, c.user.id);
    const character = row ? await fullChar(c, parseChar(row)) : null;
    // плашку «Йде подія» бачать лише учасники
    const myEv = character && evs.find((e) => e.members.includes(character.id));
    if (myEv) base.event = { ...evBrief(myEv), combat: await combatView(c, myEv, false) };
    const mates = (await all(c.db, `SELECT ch.id, ch.sheet, u.first_name FROM characters ch JOIN members m ON m.room_id = ch.room_id AND m.user_id = ch.user_id
      LEFT JOIN users u ON u.id = ch.user_id WHERE ch.room_id = ? AND ch.alive = 1 AND ch.user_id != ?`, room.id, c.user.id))
      .map((r) => ({ charId: r.id, name: JSON.parse(r.sheet).name, playerName: r.first_name }));
    const fallen = (await all(c.db, 'SELECT id, sheet FROM characters WHERE room_id = ? AND user_id = ? AND alive = 0 ORDER BY id DESC', room.id, c.user.id))
      .map((r) => { const s = JSON.parse(r.sheet); return { id: r.id, name: s.name, level: s.level, classId: s.classId }; });
    return { role: 'player', room: base, character, mates, fallen, lastRoll: mem.last_roll ? JSON.parse(mem.last_roll) : null, helpRequested: !character && !!mem.help_req };
  },

  // Довге опитування: відповідає, щойно версія кімнати зміниться (або за ~20 с)
  async watch(c, { roomId, since }) {
    const id = str(roomId, 12).toUpperCase();
    const room = await first(c.db, 'SELECT master_id, deleted, version FROM rooms WHERE id = ?', id);
    if (!room || room.deleted) return { gone: true };
    if (room.master_id !== c.user.id && !(await isMember(c, id))) return { gone: true };
    const deadline = Date.now() + Number(c.env.WATCH_TIMEOUT_MS || 20000);
    const want = Number(since);
    let v = room.version || 0;
    while (v === want && Date.now() < deadline) {
      await sleep(1000);
      const r = await first(c.db, 'SELECT deleted, version FROM rooms WHERE id = ?', id);
      if (!r || r.deleted) return { gone: true };
      v = r.version || 0;
    }
    return { version: v };
  },

  // ----- Каталог майстра (спільний для всіх його кімнат) -----
  async myItems(c) {
    const rows = await all(c.db, 'SELECT id, data FROM master_items WHERE owner_id = ? ORDER BY id DESC', c.user.id);
    return { items: rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) })) };
  },
  async saveMyItem(c, { id, item }) {
    const data = sanitizeItem(item);
    if (id) {
      const r = await run(c.db, 'UPDATE master_items SET data = ? WHERE id = ? AND owner_id = ?', JSON.stringify(data), int(id, 0, 1e12, 0), c.user.id);
      if (!(r.meta && r.meta.changes)) fail('Предмет не знайдено у твоєму каталозі');
      return { id: Number(id) };
    }
    const n = await first(c.db, 'SELECT COUNT(*) AS n FROM master_items WHERE owner_id = ?', c.user.id);
    if (n.n >= MAX_MY_ITEMS) fail(`У каталозі вже ${MAX_MY_ITEMS} предметів — видали непотрібні`);
    const r = await run(c.db, 'INSERT INTO master_items (owner_id, data, created_at) VALUES (?, ?, ?)', c.user.id, JSON.stringify(data), now());
    return { id: r.meta && r.meta.last_row_id };
  },
  async deleteMyItem(c, { id }) {
    await run(c.db, 'DELETE FROM master_items WHERE id = ? AND owner_id = ?', int(id, 0, 1e12, 0), c.user.id);
  },

  // ----- Ефекти: каталог майстра -----
  async myEffects(c) {
    const rows = await all(c.db, 'SELECT id, data FROM master_effects WHERE owner_id = ? ORDER BY id DESC', c.user.id);
    return { effects: rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) })) };
  },
  async saveMyEffect(c, { id, effect }) {
    const data = sanitizeEffect(effect);
    if (id) {
      const r = await run(c.db, 'UPDATE master_effects SET data = ? WHERE id = ? AND owner_id = ?', JSON.stringify(data), int(id, 0, 1e12, 0), c.user.id);
      if (!(r.meta && r.meta.changes)) fail('Ефект не знайдено у твоєму каталозі');
      return { id: Number(id) };
    }
    const n = await first(c.db, 'SELECT COUNT(*) AS n FROM master_effects WHERE owner_id = ?', c.user.id);
    if (n.n >= MAX_MY_EFFECTS) fail(`У каталозі вже ${MAX_MY_EFFECTS} ефектів — видали непотрібні`);
    const r = await run(c.db, 'INSERT INTO master_effects (owner_id, data, created_at) VALUES (?, ?, ?)', c.user.id, JSON.stringify(data), now());
    return { id: r.meta && r.meta.last_row_id };
  },
  async deleteMyEffect(c, { id }) {
    await run(c.db, 'DELETE FROM master_effects WHERE id = ? AND owner_id = ?', int(id, 0, 1e12, 0), c.user.id);
  },

  // ----- Ефекти на персонажах: накладає й веде майстер (трекера ходу немає — майстер сам зменшує лічильник) -----
  async addEffect(c, { charId, key, myId, n, unit }) {
    const { ch, room } = await charAccess(c, charId, { master: true });
    let data;
    let def = null;
    if (key) {
      def = R.EFFECTS[key];
      if (!def) fail('Ефект не знайдено');
      data = { name: def.name, icon: def.icon };
    } else {
      const r = await first(c.db, 'SELECT data FROM master_effects WHERE id = ? AND owner_id = ?', int(myId, 0, 1e12, 0), c.user.id);
      if (!r) fail('Ефект не знайдено у твоєму каталозі');
      const e = JSON.parse(r.data);
      data = { name: e.name, icon: e.icon, desc: e.desc, custom: 1 };
    }
    const { id, d } = await putEffect(c, room, ch, key, n, unit, data);
    await addLog(c, room, `наклав ефект «${data.name}» на ${ch.sheet.name} — ${fxDur(d.n, d.unit)}`);
    return { id, ...d };
  },
  // −/+ до лічильника; на нулі ефект знімається
  async stepEffect(c, { effectId, delta }) {
    const fx = await first(c.db, 'SELECT * FROM char_effects WHERE id = ?', int(effectId, 0, 1e12, 0));
    if (!fx) fail('Ефект не знайдено');
    const { ch, room } = await charAccess(c, fx.char_id, { master: true, alive: false });
    if (fx.unit === 'perm') fail('Цей ефект діє до зняття');
    const n = Math.min(fx.unit === 'lvl' ? (R.EFFECTS.exhaustion.max || 6) : 999, fx.n + int(delta, -999, 999, 0));
    const name = JSON.parse(fx.data).name;
    if (n <= 0) {
      await run(c.db, 'DELETE FROM char_effects WHERE id = ?', fx.id);
      await addLog(c, room, `ефект «${name}» на ${ch.sheet.name} закінчився`);
      return { removed: true };
    }
    await run(c.db, 'UPDATE char_effects SET n = ? WHERE id = ?', n, fx.id);
    await run(c.db, 'UPDATE rooms SET version = version + 1 WHERE id = ?', room.id);
    return { n };
  },
  async removeEffect(c, { effectId }) {
    const fx = await first(c.db, 'SELECT * FROM char_effects WHERE id = ?', int(effectId, 0, 1e12, 0));
    if (!fx) fail('Ефект не знайдено');
    const { ch, room } = await charAccess(c, fx.char_id, { master: true, alive: false });
    await run(c.db, 'DELETE FROM char_effects WHERE id = ?', fx.id);
    await addLog(c, room, `зняв ефект «${JSON.parse(fx.data).name}» з ${ch.sheet.name}`);
    return { removed: true };
  },

  // ----- Бестіарій майстра: свої вороги -----
  async myMonsters(c) {
    const rows = await all(c.db, 'SELECT id, data FROM master_monsters WHERE owner_id = ? ORDER BY id DESC', c.user.id);
    return { monsters: rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) })) };
  },
  async saveMyMonster(c, { id, monster }) {
    const data = sanitizeMonster(monster);
    if (id) {
      const r = await run(c.db, 'UPDATE master_monsters SET data = ? WHERE id = ? AND owner_id = ?', JSON.stringify(data), int(id, 0, 1e12, 0), c.user.id);
      if (!(r.meta && r.meta.changes)) fail('Ворога не знайдено у твоєму бестіарії');
      return { id: Number(id) };
    }
    const n = await first(c.db, 'SELECT COUNT(*) AS n FROM master_monsters WHERE owner_id = ?', c.user.id);
    if (n.n >= 300) fail('У бестіарії вже 300 ворогів — видали непотрібних');
    const r = await run(c.db, 'INSERT INTO master_monsters (owner_id, data, created_at) VALUES (?, ?, ?)', c.user.id, JSON.stringify(data), now());
    return { id: r.meta && r.meta.last_row_id };
  },
  async deleteMyMonster(c, { id }) {
    await run(c.db, 'DELETE FROM master_monsters WHERE id = ? AND owner_id = ?', int(id, 0, 1e12, 0), c.user.id);
  },

  // ----- Бій: вороги, ініціатива, черговість -----
  async addEnemy(c, { roomId, eventId, mon, count }) {
    const { room, ev } = await combatEvent(c, roomId, eventId);
    const src = await monsterSource(c, mon);
    const n = int(count, 1, 20, 1);
    const rows = await combatRows(c, ev.id);
    if (rows.length + n > 60) fail('Забагато учасників бою');
    let num = Math.max(0, ...rows.filter((r) => r.mon === src.mon).map((r) => r.num));
    const inits = [];
    for (let i = 0; i < n; i++) {
      num += 1;
      const init = R.rollDie(20) + src.initMod;
      inits.push(init);
      await run(c.db, 'INSERT INTO combatants (event_id, mon, data, name, num, init, init_mod, hp, hp_max, ac, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ev.id, src.mon, src.data ? JSON.stringify(src.data) : null, src.name, num, init, src.initMod, src.hp, src.hp, src.ac, now());
    }
    await addLog(c, room, `додав у бій: ${src.name}${n > 1 ? ` ×${n}` : ''} (ініціатива ${inits.join(', ')})`, undefined, ev.id);
    return { added: n };
  },
  async removeEnemy(c, { roomId, id }) {
    const { room, ev, r } = await combatantOf(c, roomId, id);
    if (r.char_id) fail('Персонажа прибирають через «Учасники»');
    await removeCombatant(c, room, ev, r);
    await addLog(c, room, `прибрав із бою: ${cbName(r)}`, undefined, ev.id);
    return { ok: true };
  },
  // ХП ворога: delta (−шкода / +лікування) або точне значення
  async enemyHp(c, { roomId, id, delta, hp, fromRoll }) {
    const { room, ev, r } = await combatantOf(c, roomId, id);
    if (r.char_id) fail('ХП персонажа змінюються на його листі');
    // шкода з кидка гравця — позначаємо, що вже знята (кнопка зникає)
    if (fromRoll) {
      const rid = int(fromRoll, 0, 1e12, 0);
      for (const x of await all(c.db, 'SELECT * FROM combatants WHERE event_id = ? AND turn IS NOT NULL', ev.id)) {
        const t = turnOf(x);
        if (t.last && t.last.dmgRollId === rid) {
          if (t.last.applied) fail('Цю шкоду вже знято');
          t.last.applied = 1;
          // «Майстер великої зброї»: вбивство зброєю ближнього бою у свій хід
          const nv0 = hp != null ? int(hp, 0, r.hp_max, r.hp) : Math.max(0, r.hp + int(delta, -99999, 99999, 0));
          if (nv0 === 0 && r.hp > 0 && t.last.melee && t.last.kind === 'attack' && ev.turn_id === x.id) t.gwm = 1;
          await saveTurn(c, x.id, t);
        }
      }
    }
    const nv = hp != null ? int(hp, 0, r.hp_max, r.hp) : Math.max(0, Math.min(r.hp_max, r.hp + int(delta, -99999, 99999, 0)));
    if (nv === r.hp) return { hp: nv };
    await run(c.db, 'UPDATE combatants SET hp = ? WHERE id = ?', nv, r.id);
    const d = nv - r.hp;
    const ds = `${d > 0 ? '+' : '−'}${Math.abs(d)}`;
    await addLog(c, room, nv === 0 ? `${cbName(r)} переможений (${ds} ХП)` : `${cbName(r)}: ${ds} ХП (${nv}/${r.hp_max})`, undefined, ev.id);
    if (nv === 0 && ev.turn_id === r.id) await advanceTurn(c, room, ev, 1, r.id);
    return { hp: nv };
  },
  // Ініціатива: число або (без числа) кинути за учасника d20 + модифікатор
  async setInit(c, { roomId, id, init }) {
    const { room, ev, r } = await combatantOf(c, roomId, id);
    const roll = init == null || init === '';
    const v = roll ? R.rollDie(20) + r.init_mod : int(init, -10, 60, 0);
    await run(c.db, 'UPDATE combatants SET init = ? WHERE id = ?', v, r.id);
    await addLog(c, room, roll ? `кинув ініціативу за ${cbName(r)}: ${v}` : `ініціатива ${cbName(r)}: ${v}`, undefined, ev.id);
    return { init: v };
  },
  // Почати бій: хто не кинув — кидає сервер; перший хід — найвища ініціатива
  async combatStart(c, { roomId, eventId }) {
    const { room, ev } = await combatEvent(c, roomId, eventId);
    const rows = await combatRows(c, ev.id);
    if (!rows.length) fail('У бою ще нікого немає');
    const auto = [];
    for (const r of rows.filter((x) => x.init == null)) {
      const v = R.rollDie(20) + r.init_mod;
      await run(c.db, 'UPDATE combatants SET init = ? WHERE id = ?', v, r.id);
      auto.push(`${cbName(r)} ${v}`);
    }
    await run(c.db, 'UPDATE events SET round = 1, turn_id = NULL WHERE id = ?', ev.id);
    ev.round = 1;
    ev.turn_id = null;
    await addLog(c, room, `⚔️ Бій почався! Раунд 1${auto.length ? ` (ініціатива кинута автоматично: ${auto.join(', ')})` : ''}`, undefined, ev.id);
    const first0 = await advanceTurn(c, room, ev, 1);
    return { turnId: first0 && first0.id };
  },
  async combatNext(c, { roomId, eventId, dir }) {
    const { room, ev } = await combatEvent(c, roomId, eventId);
    if (!ev.round) fail('Бій ще не почався');
    const nx = await advanceTurn(c, room, ev, int(dir, -1, 1, 1) < 0 ? -1 : 1);
    return { turnId: nx && nx.id, round: ev.round };
  },
  // Гравець завершує свій хід
  async endTurn(c, { charId }) {
    const { ch, room } = await charAccess(c, charId, { owner: true });
    const evId = await charEventId(c, ch.id);
    const ev = evId && (await activeEvents(c, room)).find((e) => e.id === evId);
    const cur = ev && ev.turn_id ? await first(c.db, 'SELECT * FROM combatants WHERE id = ?', ev.turn_id) : null;
    if (!cur || cur.char_id !== ch.id) fail('Зараз не твій хід');
    await addLog(c, room, 'завершив хід', charActor(c, ch), ev.id);
    const nx = await advanceTurn(c, room, ev, 1);
    return { turnId: nx && nx.id };
  },
  // Дія гравця в бою: витрата за правилами 5e (R.turnOptions); атака й перевірка чекають кидка й рішення майстра.
  // У чужий хід — лише реакція та вміння «без дії»; t.allow — виняток від майстра на одну дію
  async combatAction(c, { charId, kind, itemId, target, spell, slot, act, resId, cost, mode, key, label, name }) {
    const { ch, room } = await charAccess(c, charId, { owner: true });
    const mine = await combatRowOf(c, room, ch);
    if (!mine) fail('Ти зараз не в бою');
    const { ev, cur, isTurn } = mine;
    const s = ch.sheet;
    const t = turnOf(cur);
    if ((t.pending || t.dmg) && kind !== 'cancel') fail('Спершу заверши попередню дію');
    if (kind === 'cancel') {
      // скасувати дію, для якої ще не кидали кубики (витрата й ресурси повертаються)
      if (!t.pending || t.pending.rollId) fail('Нічого скасовувати');
      const p = t.pending;
      if (p.refund) await spendRes(c, room, ch, p.refund, -1);
      Object.assign(t, p.prev || {});
      t.pending = null;
      await saveTurn(c, cur.id, t);
      await addLog(c, room, 'скасував дію', charActor(c, ch), ev.id);
      return { ok: true, turn: turnPublic(t) };
    }
    const effects = await loadEffects(c, [ch.id]);
    const lim = R.turnLimits(s, effects);
    const weapons = await charWeaponsSrv(c, ch.id, s);
    const ctx = { t, effects, res: resLeft(s), myTurn: isTurn, weapons };
    // запит до правил
    let req;
    let it = null;
    let sp = null;
    if (kind === 'attack') {
      const m = mode || (isTurn ? 'main' : 'reaction');
      if (!R.ATTACK_MODES[m]) fail('Невідомий режим атаки');
      req = { kind: 'attack', mode: m };
    } else if (kind === 'spell') {
      sp = { name: str(spell, 80).trim() };
      if (!sp.name) fail('Закляття не знайдено');
      req = { kind: 'spell', name: sp.name };
    } else if (kind === 'check') {
      const k = str(key, 40);
      if (!/^(skill|ability|save):[a-z_]+$/.test(k)) fail('Невідома перевірка');
      req = { kind: 'check', key: k };
    } else if (kind === 'item') {
      const row = await first(c.db, 'SELECT id, data FROM items WHERE id = ? AND char_id = ?', int(itemId, 0, 1e12, 0), ch.id);
      if (!row) fail('Предмет не знайдено');
      it = { id: row.id, d: JSON.parse(row.data) };
      req = { kind: 'item', item: it.d };
    } else if (kind === 'feature') {
      req = { kind: 'feature', resId: str(resId, 40) };
    } else if (kind === 'rfeat') {
      const nm = str(name, 80);
      if (nm === 'ready') { if (!t.readied) fail('Немає підготовленої дії'); } else if (!R.reactionFeatures(s).some((f) => f.id === nm)) fail('Немає такого вміння');
      req = { kind: 'rfeat', name: nm };
    } else {
      if (!CB_ACTS_SRV[act]) fail('Невідома дія');
      req = { kind: 'std', act };
    }
    const rules = R.turnOptions(s, req, ctx);
    const exc = !!t.allow;
    let o;
    if (exc) {
      // виняток від майстра: будь-яка витрата, правила й стани не заважають
      const cc = R.COSTS.includes(cost) ? cost : (R.defaultOption(rules) || { cost: 'action' }).cost;
      o = rules.opts.find((x) => x.cost === cc) || { cost: cc, note: 'Виняток від майстра', extra: null };
    } else {
      if (rules.why) fail(rules.why);
      o = cost ? rules.opts.find((x) => x.cost === cost) : R.defaultOption(rules);
      if (!o) fail(`За правилами ця дія не може коштувати «${R.COST_NAMES[cost] || cost}»`);
      if (!o.ok) fail(o.why || 'Зараз не можна');
    }
    const prev = JSON.parse(JSON.stringify({ ...t, pending: null, dmg: null, last: t.last, ask: null }));
    const tgt = target ? await first(c.db, 'SELECT * FROM combatants WHERE id = ? AND event_id = ?', int(target, 0, 1e12, 0), ev.id) : null;
    const to = tgt ? ` → ${cbName(tgt)}` : '';
    const costTag = ['bonus', 'reaction', 'haste'].includes(o.cost) ? ` · ${R.COST_NAMES[o.cost].toLowerCase()}` : '';
    const apa = R.attacksPerAction(s);
    let text;
    if (kind === 'attack') {
      const m = req.mode;
      const okW = R.modeWeapons(m, s, weapons, t);
      const wid = int(itemId, -9, 1e12, 0);
      const w = okW.find((x) => x.id === wid) || (exc && weapons.find((x) => x.id === wid)) || (wid === 0 && exc ? { id: 0, d: null } : null);
      if (!w) fail('Ця зброя не підходить для такої атаки');
      spendTurn(t, o.cost, { attack: m === 'main', apa, lim });
      await spendRes(c, room, ch, o.extra);
      const tags = R.weaponTags(w.d);
      t.atkN = (t.atkN || 0) + 1;
      if (m === 'main' || m === 'haste') {
        t.atk = 1;
        t.w = { ...t.w, light: t.w.light || (tags.melee && !!tags.light), oneMelee: t.w.oneMelee || (tags.melee && tags.oneHanded), monk: t.w.monk || !!tags.monk, polearm: t.w.polearm || !!tags.polearm, oneHanded: t.w.oneHanded || tags.oneHanded !== false };
        t.ids = [...new Set([...(t.ids || []), w.id])];
      }
      if (m === 'flurry') { t.battacks = 1; t.bmode = 'flurry'; }
      if (m === 'flurry2') { t.battacks = Math.max(0, t.battacks - 1); if (!t.battacks) t.bmode = ''; }
      const M = R.ATTACK_MODES[m];
      const wn = w.d ? w.d.name : 'Беззбройний удар';
      text = m === 'main' ? `⚔️ атакує${to}: ${wn}${costTag}` : `⚔️ атакує${to}: ${wn} (${M.name})`;
      t.pending = { kind: 'attack', mode: m, itemId: w.id || null, target: tgt ? tgt.id : null, melee: !!tags.melee, prev, refund: o.extra || null };
      if (m === 'polearm') t.pending.dice = { 4: 1 };
      if (m === 'offhand' && !R.hasFightingStyle(s, 'twf')) t.pending.noMod = 1;
    } else if (kind === 'spell') {
      const info = R.spellByName(sp.name);
      const lvl = int(slot, 0, 9, 0);
      spendTurn(t, o.cost, { lim });
      if (lvl > 0) {
        const max = R.sheetSlots(s);
        const used = (s.spell.slotsUsed || []).slice(0, 9);
        while (used.length < 9) used.push(0);
        if ((used[lvl - 1] || 0) >= (max[lvl - 1] || 0)) fail(`Немає вільних комірок ${lvl} кола`);
        used[lvl - 1] += 1;
        s.spell.slotsUsed = used;
        await saveSheet(c, ch);
        await evAct(c, room, ch, 'slot', 1, { lvl });
      }
      await spendRes(c, room, ch, o.extra);
      // правило бонусного закляття стежить лише за власним ходом
      if (isTurn) t.spells = [...(t.spells || []), { lvl: info ? info.level : lvl, cost: o.cost }];
      text = `✨ творить «${sp.name}»${lvl > 0 ? ` (${lvl} коло)` : ''}${to}${costTag}`;
      if (mode === 'attack') t.pending = { kind: 'spellattack', spell: sp.name, slot: lvl, target: tgt ? tgt.id : null, prev, refund: o.extra || null };
    } else if (kind === 'check') {
      spendTurn(t, o.cost, { attack: !!o.attack, apa, lim });
      if (o.attack) { t.atk = 1; t.atkN = (t.atkN || 0) + 1; }
      text = `🎲 перевірка: ${str(label, 60) || req.key}${to}${costTag}`;
      t.pending = { kind: 'check', key: req.key, target: tgt ? tgt.id : null, prev };
    } else if (kind === 'item') {
      spendTurn(t, o.cost, { lim });
      await OPS.useItem(c, { itemId: it.id, qty: 1 });
      if (t.allow) t.allow = 0;
      await saveTurn(c, cur.id, t);
      return { ok: true, turn: turnPublic(t) };
    } else if (kind === 'feature') {
      const r = R.sheetResources(s).find((x) => x.id === req.resId);
      if (!r) fail('Невідомий ресурс');
      if (r.used >= r.max) fail(`«${r.name}» вже витрачено`);
      spendTurn(t, o.cost, { lim });
      // «Сплеск дій» повертає дію (раз за хід)
      if (r.id === 'actionSurge') { t.action = 0; t.attacks = 0; t.surged = 1; }
      s.resUsed = { ...(s.resUsed || {}), [r.id]: r.used + 1 };
      await saveSheet(c, ch);
      await evAct(c, room, ch, 'res', 1, { name: r.name });
      // «Лють» — одразу ефект на персонажі (1 хвилина = 10 раундів)
      if (r.id === 'rage') await putEffect(c, room, ch, 'rage');
      text = `🌟 використовує «${r.name}»${to}${costTag}`;
    } else if (kind === 'rfeat') {
      spendTurn(t, o.cost, { lim });
      if (req.name === 'ready') { t.readied = 0; text = `⚡ виконує підготовлену дію${to}`; }
      else text = `⚡ ${R.reactionFeatures(s).find((f) => f.id === req.name).name}${to}`;
    } else {
      spendTurn(t, o.cost, { lim });
      await spendRes(c, room, ch, o.extra);
      if (act === 'ready') t.readied = 1;
      if (act === 'dash') t.dashed = 1;
      text = `${CB_ACTS_SRV[act]}${to}${costTag}`;
    }
    if (exc) { t.allow = 0; text += ' · виняток майстра'; }
    t.ask = null;
    t.denied = null;
    await saveTurn(c, cur.id, t);
    await evAct(c, room, ch, 'act', 1, { text });
    await addLog(c, room, text, charActor(c, ch), ev.id);
    return { ok: true, turn: turnPublic(t) };
  },
  // Гравець просить майстра дозволити дію поза правилами
  async combatAsk(c, { charId, text }) {
    const { ch, room } = await charAccess(c, charId, { owner: true });
    const mine = await combatRowOf(c, room, ch);
    if (!mine) fail('Ти зараз не в бою');
    const t = turnOf(mine.cur);
    t.ask = str(text, 120).trim() || 'Дія поза правилами';
    t.denied = null;
    await saveTurn(c, mine.cur.id, t);
    await addLog(c, room, `🙋 просить виняток: ${t.ask}`, charActor(c, ch), mine.ev.id);
    return { ok: true };
  },
  // Майстер дозволяє (на одну дію) чи відмовляє
  async combatAllow(c, { roomId, id, allow }) {
    const { room, ev, r } = await combatantOf(c, roomId, id);
    if (!r.char_id) fail('Лише для персонажів');
    const t = turnOf(r);
    const asked = t.ask;
    t.allow = allow ? 1 : 0;
    t.denied = !allow && asked ? asked : null;
    t.ask = null;
    await saveTurn(c, r.id, t);
    await addLog(c, room, allow ? `🔓 виняток для ${r.name}${asked ? `: ${asked}` : ''}` : `✗ без винятку для ${r.name}`, undefined, ev.id);
    return { ok: true };
  },

  // ---------- Події майстра (можуть іти паралельно; персонаж — в одній події) ----------
  async startEvent(c, { roomId, name, type, charIds }) {
    const room = await requireMaster(c, roomId);
    await activeEvents(c, room);
    const raw = Array.isArray(charIds) ? charIds : [];
    if (raw.length > 50) fail('Забагато учасників');
    const alive = new Set((await all(c.db, 'SELECT id FROM characters WHERE room_id = ? AND alive = 1', room.id)).map((r) => r.id));
    const ids = raw.map((x) => int(x, 0, 1e12, 0)).filter((x) => alive.has(x));
    if (!ids.length) fail('Обери хоча б одного учасника');
    const t = R.EVENT_TYPES[type] ? type : 'other';
    const cnt = await first(c.db, 'SELECT COUNT(*) AS n FROM events WHERE room_id = ?', room.id);
    const num = (cnt ? cnt.n : 0) + 1;
    const nm = str(name, 80).trim() || `Подія ${num}`;
    const r = await run(c.db, 'INSERT INTO events (room_id, num, session, name, type, started_at) VALUES (?, ?, ?, ?, ?, ?)', room.id, num, room.session, nm, t, now());
    const ev = await getEvent(c, r.meta && r.meta.last_row_id);
    await addLog(c, room, `почав подію «${nm}» (${evTypeName(t).toLowerCase()})`, undefined, ev.id);
    const res = await setEventMembers(c, room, ev, ids);
    return { id: ev.id, name: nm, merged: res.merged };
  },

  // Змінити склад події (перевести з іншої, додати, прибрати)
  async eventMembers(c, { roomId, eventId, charIds }) {
    const room = await requireMaster(c, roomId);
    await activeEvents(c, room);
    const ev = await getEvent(c, int(eventId, 0, 1e12, 0));
    if (!ev || ev.room_id !== room.id || ev.ended_at) fail('Подію не знайдено або вже завершено');
    const res = await setEventMembers(c, room, ev, Array.isArray(charIds) ? charIds.slice(0, 50) : []);
    return { merged: res.merged, finished: !!res.finished, sent: res.finished ? res.finished.sent : undefined };
  },

  // Об'єднати подію з іншою: учасники й записи переходять туди, звіт буде один
  async mergeEvent(c, { roomId, eventId, intoId }) {
    const room = await requireMaster(c, roomId);
    await activeEvents(c, room);
    const from = await getEvent(c, int(eventId, 0, 1e12, 0));
    const into = await getEvent(c, int(intoId, 0, 1e12, 0));
    if (!from || !into || from.id === into.id || from.room_id !== room.id || into.room_id !== room.id || from.ended_at || into.ended_at) fail('Подію не знайдено або вже завершено');
    await mergeEventInto(c, room, from, into);
    return { ok: true, name: into.name };
  },

  async endEvent(c, { roomId, eventId }) {
    const room = await requireMaster(c, roomId);
    const evs = await activeEvents(c, room);
    const ev = eventId == null && evs.length === 1 ? evs[0] : evs.find((e) => e.id === int(eventId, 0, 1e12, 0));
    if (!ev) fail('Зараз немає активної події');
    const r = await finishEvent(c, room, ev);
    if (!r.sent) fail('Подію завершено, але файл не надіслано — відкрий чат із ботом і натисни «Почати» (Start)');
    return r;
  },

  // Поправка майстра: промах (кидок шкоди не рахується) або додана/віднята шкода персонажа
  // mark: 0 — зняти позначку, 1 — провал/промах, 2 — успіх/влучання (miss — старий параметр: true = 1)
  async eventDamage(c, { roomId, charId, delta, rollId, miss, mark, note }) {
    const room = await requireMaster(c, roomId);
    const evs = await activeEvents(c, room);
    if (!evs.length) fail('Зараз немає активної події');
    if (rollId != null) {
      const r = await first(c.db, 'SELECT * FROM dice_rolls WHERE id = ? AND room_id = ?', int(rollId, 0, 1e12, 0), room.id);
      if (!r || !evs.some((e) => e.id === r.event_id)) fail('Кидок не знайдено');
      await setRollMark(c, room, r, mark == null ? (miss ? 1 : 0) : int(mark, 0, 2, 0));
      return { ok: true };
    }
    const ch = await first(c.db, 'SELECT * FROM characters WHERE id = ? AND room_id = ?', int(charId, 0, 1e12, 0), room.id);
    if (!ch) fail('Персонажа не знайдено');
    const evId = await charEventId(c, ch.id);
    if (!evId) fail('Персонаж не бере участі в жодній події');
    const n = int(delta, -9999, 9999, 0);
    if (!n) fail('Вкажи кількість');
    const nt = str(note, 80).trim();
    await run(c.db, 'INSERT INTO event_acts (event_id, char_id, ts, kind, value, data) VALUES (?, ?, ?, ?, ?, ?)', evId, ch.id, now(), 'adj', n, nt ? JSON.stringify({ note: nt }) : null);
    await addLog(c, room, `поправка шкоди ${JSON.parse(ch.sheet).name}: ${R.fmtMod(n)}${nt ? ` (${nt})` : ''}`, undefined, evId);
    return { ok: true };
  },

  // Кидок кубиків гравцем: сервер кидає, результат іде в історію персонажа й у журнал майстра
  async rollDice(c, { charId, kind, key, dice, mod, mode }) {
    const { ch, room } = await charAccess(c, charId, { owner: true });
    const s = ch.sheet;
    const counts = DICE_SIDES.map((sd) => [sd, int(dice && dice[sd], 0, 20, 0)]).filter(([, n]) => n > 0);
    const totalDice = counts.reduce((a, [, n]) => a + n, 0);
    const m = int(mod, -50, 50, 0);
    // шкода без кубиків — лише для фіксованої (беззбройний удар: 1 + СИЛ)
    if (!totalDice && !(kind === 'damage' && m > 0)) fail('Обери хоча б один кубик');
    if (totalDice > 40) fail('Забагато кубиків (максимум 40)');
    const adv = mode === 'adv' || mode === 'dis' ? mode : '';
    // що саме кидаємо — підпис для історії й журналу
    let label = 'Довільний кидок';
    if (kind === 'init') label = 'Ініціатива';
    else if ((kind === 'ability' || kind === 'save') && R.ABILITY_NAMES[key]) label = `${kind === 'save' ? 'Рятівний кидок' : 'Перевірка'}: ${R.ABILITY_NAMES[key]}`;
    else if (kind === 'skill' && R.SKILLS[key]) label = R.SKILLS[key][0];
    else if (kind === 'spellattack') label = str(key, 60).trim() ? `Атака закляттям (${str(key, 60).trim()})` : 'Атака закляттям';
    else if (kind === 'damage' && (key == null || key === '')) label = 'Шкода';
    else if ((kind === 'attack' || kind === 'damage') && String(key) === '0') label = `${kind === 'attack' ? 'Атака' : 'Шкода'}: Беззбройний удар`;
    else if (kind === 'damage' && !/^-?\d+$/.test(String(key))) label = `Шкода (${str(key, 60).trim()})`;
    else if ((kind === 'attack' || kind === 'damage') && /^-\d$/.test(String(key))) {
      // природна зброя раси (пазурі, роги, укус…)
      const nw = R.naturalWeapons(ch.sheet).find((w) => w.id === Number(key));
      if (!nw) fail('Немає такої природної зброї');
      label = `${kind === 'attack' ? 'Атака' : 'Шкода'}: ${nw.d.name}`;
    } else if (kind === 'attack' || kind === 'damage') {
      const it = await first(c.db, 'SELECT data FROM items WHERE id = ? AND char_id = ?', int(key, 0, 1e12, 0), ch.id);
      if (!it) fail('Предмет не знайдено (можливо, його вже змінили). Онови екран.');
      label = `${kind === 'attack' ? 'Атака' : 'Шкода'}: ${JSON.parse(it.data).name}`;
    }
    const groups = counts.map(([sides, n]) => {
      const rolls = [];
      const kept = [];
      for (let i = 0; i < n; i++) {
        if (sides === 20 && adv) {
          const a = R.rollDie(20); const b = R.rollDie(20);
          rolls.push(a, b);
          kept.push(adv === 'adv' ? Math.max(a, b) : Math.min(a, b));
        } else { const v = R.rollDie(sides); rolls.push(v); kept.push(v); }
      }
      return { s: sides, n, r: rolls, k: kept };
    });
    const total = groups.reduce((a, g) => a + g.k.reduce((x, y) => x + y, 0), 0) + m;
    const d20 = groups.find((g) => g.s === 20);
    const crit = d20 && d20.n === 1 && totalDice === 1 ? (d20.k[0] === 20 ? 20 : d20.k[0] === 1 ? 1 : 0) : 0;
    const data = { label, kind: kind || 'free', groups, mod: m, mode: adv, total, crit };
    const ts = now();
    const r = await run(c.db, 'INSERT INTO dice_rolls (room_id, char_id, user_id, ts, data, event_id, session) VALUES (?, ?, ?, ?, ?, ?, ?)', room.id, ch.id, c.user.id, ts, JSON.stringify(data), (await charEventId(c, ch.id)) || null, room.session);
    const rollId = r.meta && r.meta.last_row_id;
    // тримаємо лише останні кидки персонажа
    await run(c.db, `DELETE FROM dice_rolls WHERE char_id = ? AND event_id IS NULL AND id NOT IN (SELECT id FROM dice_rolls WHERE char_id = ? ORDER BY id DESC LIMIT 50)`, ch.id, ch.id);
    const expr = groups.map((g) => {
      const name = `${g.n > 1 ? g.n : ''}к${g.s}`;
      if (g.s === 20 && adv) return `${name} ${adv === 'adv' ? 'з перевагою' : 'з перешкодою'} (${g.r.join(', ')})`;
      return `${name} (${g.r.join(', ')})`;
    }).join(' + ') + (m ? ` ${m > 0 ? '+' : '−'} ${Math.abs(m)}` : '');
    const critTxt = crit === 20 ? ' · природна 20!' : crit === 1 ? ' · природна 1' : '';
    await addLog(c, room, `🎲 ${label}: ${expr} = ${total}${critTxt}`, charActor(c, ch), undefined, rollId);
    // хід у бою: кидок атаки / перевірки йде на рішення майстра; кидок шкоди після влучання завершує дію
    const mine = await combatRowOf(c, room, ch);
    if (mine) {
      const t = turnOf(mine.cur);
      const atk = ['attack', 'spellattack'].includes(kind);
      if (t.pending && !t.pending.rollId && ((atk && ['attack', 'spellattack'].includes(t.pending.kind)) || (t.pending.kind === 'check' && ['skill', 'ability', 'save'].includes(kind)))) {
        t.pending = { ...t.pending, rollId, total, crit, label };
        await saveTurn(c, mine.cur.id, t);
      } else if (t.dmg && kind === 'damage') {
        const tg = t.dmg.target ? await first(c.db, 'SELECT * FROM combatants WHERE id = ?', t.dmg.target) : null;
        t.last = { ...t.dmg, dmgTotal: total, dmgRollId: rollId };
        t.dmg = null;
        await saveTurn(c, mine.cur.id, t);
        await addLog(c, room, `🎯 шкода${tg ? ` по ${cbName(tg)}` : ''}: ${total}`, charActor(c, ch), mine.ev.id);
      }
    }
    // кидок ініціативи учасника бою, який ще не кидав, — стає його ініціативою
    if (kind === 'init') {
      const evId = await charEventId(c, ch.id);
      if (evId) await run(c.db, 'UPDATE combatants SET init = ? WHERE event_id = ? AND char_id = ? AND init IS NULL', total, evId, ch.id);
    }
    return { roll: { id: rollId, ts, ...data } };
  },

  // Позначка майстра для будь-якого кидка сесії: 2 — попадання/успіх, 1 — промах/провал, 0 — зняти
  async markRoll(c, { roomId, rollId, mark }) {
    const room = await requireMaster(c, roomId);
    const r = await first(c.db, 'SELECT * FROM dice_rolls WHERE id = ? AND room_id = ?', int(rollId, 0, 1e12, 0), room.id);
    if (!r) fail('Кидок не знайдено');
    await setRollMark(c, room, r, int(mark, 0, 2, 0));
    return { ok: true };
  },

  // Видалити кидок: зникає з історії гравця, стрічки, журналу, підсумків і звіту події (без сповіщення)
  async deleteRoll(c, { roomId, rollId }) {
    const room = await requireMaster(c, roomId);
    const r = await first(c.db, 'SELECT id, char_id FROM dice_rolls WHERE id = ? AND room_id = ?', int(rollId, 0, 1e12, 0), room.id);
    if (!r) fail('Кидок не знайдено');
    await forgetPendingRoll(c, r);
    await c.db.batch([
      q(c.db, 'DELETE FROM dice_rolls WHERE id = ?', r.id),
      q(c.db, 'DELETE FROM logs WHERE room_id = ? AND roll_id = ?', room.id, r.id),
      q(c.db, 'UPDATE rooms SET version = version + 1 WHERE id = ?', room.id),
    ]);
    return { ok: true };
  },

  // Гравець просить майстра допомогти створити персонажа (або скасовує прохання)
  async askMaster(c, { roomId, cancel }) {
    const room = await getRoom(c, roomId);
    const mem = await first(c.db, 'SELECT * FROM members WHERE room_id = ? AND user_id = ?', room.id, c.user.id);
    if (!mem) fail('Ти не в цій кімнаті');
    if (await first(c.db, 'SELECT 1 AS x FROM characters WHERE room_id = ? AND user_id = ? AND alive = 1', room.id, c.user.id)) fail('У тебе вже є живий персонаж');
    if (cancel) {
      if (!mem.help_req) return { helpRequested: false };
      await run(c.db, 'UPDATE members SET help_req = NULL WHERE room_id = ? AND user_id = ?', room.id, c.user.id);
      await addLog(c, room, 'скасував прохання допомогти створити персонажа');
      return { helpRequested: false };
    }
    if (mem.help_req) return { helpRequested: true };
    await run(c.db, 'UPDATE members SET help_req = ? WHERE room_id = ? AND user_id = ?', now(), room.id, c.user.id);
    await addLog(c, room, 'попросив майстра допомогти створити персонажа');
    notify(c, room.master_id, `🙋 ${c.user.name} просить допомогти створити персонажа в кімнаті «${room.name}». Відкрий кімнату й натисни «Допомогти створити».`);
    return { helpRequested: true };
  },

  async rollAbilities(c, { roomId, forUserId }) {
    const room = await getRoom(c, roomId);
    const t = await creationTarget(c, room, forUserId);
    const rolls = Array.from({ length: 6 }, () => R.roll4d6DropLowest());
    await run(c.db, 'UPDATE members SET last_roll = ? WHERE room_id = ? AND user_id = ?', JSON.stringify(rolls), room.id, t.uid);
    await addLog(c, room, t.helper
      ? `кинув характеристики для гравця ${t.name} (4к6, без найменшого): ${rolls.join(', ')}`
      : `кинув характеристики (4к6, без найменшого): ${rolls.join(', ')}`);
    return { rolls };
  },

  async createCharacter(c, { roomId, method, input, forUserId }) {
    const room = await getRoom(c, roomId);
    const tgt = await creationTarget(c, room, forUserId);
    const mem = tgt.mem;
    const err = R.validateBase(method, input && input.base, mem.last_roll ? JSON.parse(mem.last_roll) : null);
    if (err) fail(err);
    const level = int(input && input.level, 1, 20, 1);
    const maxLv = room.max_start_level || 1;
    if (level > maxLv) fail(maxLv > 1 ? `У цій кімнаті можна почати максимум з ${maxLv} рівня` : 'У цій кімнаті персонажі починають з 1 рівня');
    const { errors, sheet } = R.buildCharacter({ ...(input || {}), level });
    if (errors.length) fail(errors.join('\n'));
    // Стартове спорядження: варіанти класу + речі передісторії, або золото кидком
    let items = [];
    let equipNote = '';
    if (input && input.equip) {
      const eq = R.resolveEquipment(sheet.classId, sheet.backgroundId, input.equip, input.profPicks || {}, sheet.prof);
      if (eq.errors.length) fail(eq.errors.join('\n'));
      if (eq.gold) {
        const [n, mul] = R.CLASS_EQUIP[sheet.classId].gold;
        const rolls = Array.from({ length: n }, () => R.rollDie(4));
        const gp = rolls.reduce((a, b) => a + b, 0) * mul;
        sheet.money.gp = (Number(sheet.money.gp) || 0) + gp;
        equipNote = `золото замість спорядження: ${n}к4${mul > 1 ? ` × ${mul}` : ''} = ${gp} ЗМ (${rolls.join('+')})`;
      } else {
        sheet.money.gp = (Number(sheet.money.gp) || 0) + eq.gp;
        items = eq.items;
        equipNote = `стартове спорядження: ${items.length} предметів, ${eq.gp} ЗМ`;
      }
    }
    const ts = now();
    const r = await run(c.db, 'INSERT INTO characters (room_id, user_id, alive, sheet, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)', room.id, tgt.uid, JSON.stringify(sheet), ts, ts);
    await run(c.db, 'UPDATE members SET help_req = NULL WHERE room_id = ? AND user_id = ?', room.id, tgt.uid);
    const newId = r.meta && r.meta.last_row_id;
    if (items.length) await giveStartItems(c, newId, sheet, items);
    // стан «на початку сесії» для нового персонажа — одразу після створення (зі стартовим спорядженням)
    await snapChar(c, room, { id: newId, sheet }, { created: 1 });
    const methodName = { standard: 'стандартний набір', pointbuy: 'купівля очками', roll: 'кидок кубиків' }[method];
    await addLog(c, room, `створив персонажа ${sheet.name}: ${R.RACES[sheet.raceId].name}, ${R.CLASSES[sheet.classId].name}${sheet.subclass ? ` (${sheet.subclass})` : ''} ${level} рів. (${methodName}; ${R.ABILITIES.map((a) => `${R.ABILITY_SHORT[a]} ${sheet.abilities[a]}`).join(', ')})${equipNote ? `; ${equipNote}` : ''}`);
    if (tgt.helper) {
      await addLog(c, room, `допоміг гравцю ${tgt.name} створити персонажа «${sheet.name}»`);
      notify(c, tgt.uid, `🧙 Майстер створив для тебе персонажа «${sheet.name}» (${R.RACES[sheet.raceId].name}, ${R.CLASSES[sheet.classId].name}, ${level} рів.) у кімнаті «${room.name}». Відкрий застосунок, щоб грати.`);
    } else {
      notify(c, room.master_id, `🧝 ${c.user.name} створив персонажа «${sheet.name}» (${R.RACES[sheet.raceId].name}, ${R.CLASSES[sheet.classId].name}, ${level} рів.) у кімнаті «${room.name}».`);
    }
    return { charId: newId };
  },

  // ----- Гравець -----
  // Бойові лічильники: хіти, рятівні від смерті, кості хітів, комірки, натхнення, відпочинок.
  // Шкода/лікування/відпочинок рахуються на сервері від свіжих даних (без перезапису застарілими значеннями).
  async trackers(c, { charId, patch }) {
    const { ch, room, isMaster } = await charAccess(c, charId, { owner: true, master: true });
    const s = ch.sheet;
    const old = JSON.parse(JSON.stringify(s));
    const p = patch || {};
    const normSlots = () => { const u = (s.spell.slotsUsed || []).slice(0, 9); while (u.length < 9) u.push(0); s.spell.slotsUsed = u; return u; };
    const extra = [];
    if ('damage' in p) {
      const n = int(p.damage, 0, 99999, 0);
      const fromTemp = Math.min(s.hp.temp, n);
      s.hp.temp -= fromTemp;
      s.hp.cur = Math.max(0, s.hp.cur - (n - fromTemp));
      if (n) extra.push(`отримав ${n} шкоди`);
    }
    if ('heal' in p) {
      const n = int(p.heal, 0, 99999, 0);
      s.hp.cur = Math.min(s.hp.max, s.hp.cur + n);
      if (n) extra.push(`лікування на ${n}`);
    }
    if ('hpCur' in p) s.hp.cur = int(p.hpCur, 0, s.hp.max, s.hp.cur);
    if ('hpTemp' in p) s.hp.temp = int(p.hpTemp, 0, 999, s.hp.temp);
    if ('deathS' in p) s.deathSaves.s = int(p.deathS, 0, 3, s.deathSaves.s);
    if ('deathF' in p) s.deathSaves.f = int(p.deathF, 0, 3, s.deathSaves.f);
    if ('hitDiceUsed' in p) {
      if (!isMaster) fail('Кості хітів витрачаються лише під час короткого відпочинку, який оголошує майстер');
      s.hitDiceUsed = int(p.hitDiceUsed, 0, s.level, s.hitDiceUsed);
    }
    if ('slotLevel' in p) {
      const i = int(p.slotLevel, 0, 8, 0);
      const max = R.sheetSlots(s);
      const v = int(p.slotUsed, 0, max[i] || 0, 0);
      if (!isMaster && v < (normSlots()[i] || 0)) fail('Комірки відновлюються лише на відпочинку (його оголошує майстер)');
      normSlots()[i] = v;
    }
    if ('resId' in p) {
      const r = R.sheetResources(s).find((x) => x.id === p.resId);
      if (!r) fail('Невідомий ресурс');
      const v = int(p.resUsed, 0, r.max, r.used);
      if (!isMaster && v < r.used) fail('Ресурси відновлюються лише на відпочинку (його оголошує майстер)');
      s.resUsed = { ...(s.resUsed || {}), [r.id]: v };
    }
    if (Array.isArray(p.slotsUsed)) {
      if (!isMaster) fail('Комірки відновлюються лише на відпочинку');
      const max = R.sheetSlots(s);
      s.spell.slotsUsed = Array.from({ length: 9 }, (_, i) => int(p.slotsUsed[i], 0, max[i] || 0, 0));
    }
    if ('inspiration' in p || 'inspDelta' in p) {
      if (!isMaster) fail('Натхнення дає й забирає лише майстер');
      const cur = R.inspCount(s);
      s.inspiration = 'inspDelta' in p ? Math.max(0, Math.min(99, cur + int(p.inspDelta, -99, 99, 0))) : int(p.inspiration, 0, 99, cur);
    }
    const diff = describeSheetDiff(old, s);
    if (!diff.length) return { ok: true };
    await saveSheet(c, ch);
    if (await charEventId(c, ch.id)) {
      // для звіту події: отримана шкода, лікування, падіння до 0 ХП, рятівні від смерті, комірки, ресурси
      const hpOld = old.hp.cur + old.hp.temp;
      const hpNew = s.hp.cur + s.hp.temp;
      if ('damage' in p || 'heal' in p || 'hpCur' in p) {
        if (hpNew < hpOld) await evAct(c, room, ch, 'taken', hpOld - hpNew);
        if (s.hp.cur > old.hp.cur) await evAct(c, room, ch, 'heal', s.hp.cur - old.hp.cur);
      }
      if (old.hp.cur > 0 && s.hp.cur === 0) await evAct(c, room, ch, 'down');
      if (s.deathSaves.s > old.deathSaves.s) await evAct(c, room, ch, 'death_s', s.deathSaves.s - old.deathSaves.s);
      if (s.deathSaves.f > old.deathSaves.f) await evAct(c, room, ch, 'death_f', s.deathSaves.f - old.deathSaves.f);
      const su = s.spell.slotsUsed || []; const ou = (old.spell && old.spell.slotsUsed) || [];
      for (let i = 0; i < 9; i++) if ((su[i] || 0) > (ou[i] || 0)) await evAct(c, room, ch, 'slot', (su[i] || 0) - (ou[i] || 0), { lvl: i + 1 });
      for (const r of R.sheetResources(s)) {
        const was = (old.resUsed || {})[r.id] || 0;
        if (r.used > was) await evAct(c, room, ch, 'res', r.used - was, { name: r.name });
      }
      const di = R.inspCount(s) - R.inspCount(old);
      if (di < 0) await evAct(c, room, ch, 'act', 1, { text: `використав натхнення ×${-di}` });
      if (di > 0) await evAct(c, room, ch, 'act', 1, { text: `отримав натхнення ×${di}` });
    }
    const text = [...extra, ...diff].join('; ');
    if (isMaster) {
      await addLog(c, room, `${s.name}: ${text}`);
      const di = R.inspCount(s) - R.inspCount(old);
      if (di && diff.length === 1) notify(c, ch.userId, di > 0 ? `⭐ Майстер дав тобі натхнення! Тепер: ${R.inspCount(s)}` : `Майстер забрав натхнення. Тепер: ${R.inspCount(s)}`);
      else notify(c, ch.userId, `🎲 Майстер: ${s.name} — ${text}`);
    } else {
      await addLog(c, room, text, charActor(c, ch));
    }
    return { ok: true };
  },

  async textInfo(c, { charId, text }) {
    const { ch, room, isMaster } = await charAccess(c, charId, { owner: true, master: true });
    const old = JSON.parse(JSON.stringify(ch.sheet));
    Object.assign(ch.sheet.text, sanitizeText(text));
    const diff = describeSheetDiff(old, ch.sheet);
    if (!diff.length) return { ok: true };
    await saveSheet(c, ch);
    await addLog(c, room, `${ch.sheet.name}: ${diff.join('; ')}`, isMaster ? undefined : charActor(c, ch));
    return { ok: true };
  },

  // Закляття: гравець — за правилами (вільні місця, заміна після підвищення, підготовка після довгого відпочинку); майстер — вільно
  async spells(c, { charId, spells }) {
    const { ch, room, isMaster } = await charAccess(c, charId, { owner: true, master: true });
    const s = ch.sheet;
    const old = JSON.parse(JSON.stringify(s));
    if (!Array.isArray(spells) || spells.length > 300) fail('Невірний список заклять');
    const r = R.checkSpells(s, s.spell.spells || [], spells, isMaster ? 'master' : 'player');
    if (r.errors.length) fail(r.errors.join('\n'));
    s.spell.spells = sanitizeSpells(r.list);
    if (!isMaster) {
      if (r.swapsUsed) s.spell.swaps = Math.max(0, (Number(s.spell.swaps) || 0) - r.swapsUsed);
      if (r.prepChanged) s.spell.prepOpen = false;
    }
    const diff = describeSheetDiff(old, s);
    if (!diff.length && JSON.stringify(old.spell) === JSON.stringify(s.spell)) return { ok: true };
    await saveSheet(c, ch);
    if (diff.length) {
      await addLog(c, room, `${s.name}: ${diff.join('; ')}`, isMaster ? undefined : charActor(c, ch));
      if (isMaster) notify(c, ch.userId, `📜 Майстер змінив закляття твого персонажа ${s.name}: ${diff.join('; ')}`);
      else notify(c, room.master_id, `📖 ${s.name}: ${diff.join('; ')}`);
    }
    return { ok: true };
  },

  async useItem(c, { itemId, qty }) {
    const { item, ch, room } = await itemAccess(c, itemId, { owner: true });
    if (!R.isConsumable(item.data)) fail('Це не витратний предмет — його кількість змінює лише майстер');
    const n = int(qty, 1, item.qty, 1);
    const left = await decItem(c, item, n);
    await evAct(c, room, ch, 'item', n, { name: item.data.name });
    await addLog(c, room, `використав ${itemName(item)} ×${n} (залишилось ${left})`, charActor(c, ch));
    notify(c, room.master_id, `🧪 ${ch.sheet.name} використав ${itemName(item)} ×${n}. Залишилось: ${left}.`);
    return { left };
  },

  async dropItem(c, { itemId }) {
    const { item, ch, room } = await itemAccess(c, itemId, { owner: true });
    if (!R.isConsumable(item.data)) fail('Це не витратний предмет — прибрати його може лише майстер');
    await run(c.db, 'DELETE FROM items WHERE id = ?', item.id);
    await evAct(c, room, ch, 'act', 1, { text: `викинув ${itemName(item)} ×${item.qty}` });
    await addLog(c, room, `викинув ${itemName(item)} ×${item.qty}`, charActor(c, ch));
    notify(c, room.master_id, `🗑 ${ch.sheet.name} викинув ${itemName(item)} ×${item.qty}.`);
  },

  async equipItem(c, { itemId, equipped, attuned }) {
    const { item, ch, room, isMaster } = await itemAccess(c, itemId, { owner: true, master: true });
    const eq = equipped === undefined ? item.equipped : !!equipped;
    const at = attuned === undefined ? item.attuned : !!attuned;
    if (at && !item.attuned && !isMaster) {
      if (!item.data.attune) fail('Цей предмет не потребує налаштування');
      const problem = R.attuneProblem(ch.sheet, item.data.attune);
      if (problem) fail(problem);
      const n = await first(c.db, 'SELECT COUNT(*) AS n FROM items WHERE char_id = ? AND attuned = 1', ch.id);
      if (n.n >= MAX_ATTUNED) fail(`Можна бути налаштованим максимум на ${MAX_ATTUNED} предмети`);
    }
    await run(c.db, 'UPDATE items SET equipped = ?, attuned = ? WHERE id = ?', eq ? 1 : 0, at ? 1 : 0, item.id);
    const parts = [];
    if (eq !== item.equipped) parts.push(eq ? 'екіпірував' : 'зняв');
    if (at !== item.attuned) parts.push(at ? 'налаштувався на' : 'скасував налаштування на');
    if (!isMaster) for (const v of parts) await evAct(c, room, ch, 'act', 1, { text: `${v} ${itemName(item)}` });
    if (parts.length) await addLog(c, room, `${parts.join(' і ')} ${itemName(item)}${isMaster ? ` (${ch.sheet.name})` : ''}`, isMaster ? undefined : charActor(c, ch));
  },

  async giveItem(c, { itemId, toCharId, qty }) {
    const { item, ch, room } = await itemAccess(c, itemId, { owner: true });
    const toRow = await first(c.db, 'SELECT * FROM characters WHERE id = ? AND alive = 1', int(toCharId, 0, 1e12, 0));
    const to = parseChar(toRow);
    if (!to || to.roomId !== room.id || to.id === ch.id) fail('Невірний отримувач');
    if (!(await isMember(c, room.id, to.userId))) fail('Отримувач уже не в кімнаті');
    const n = int(qty, 1, item.qty, 1);
    await decItem(c, item, n);
    await addItemToChar(c, to.id, item.data, n);
    await evAct(c, room, ch, 'act', 1, { text: `передав ${itemName(item)} ×${n} → ${to.sheet.name}` });
    await addLog(c, room, `передав ${itemName(item)} ×${n} → ${to.sheet.name}`, charActor(c, ch));
    notify(c, to.userId, `🎁 ${ch.sheet.name} передав тобі ${itemName(item)} ×${n}.`);
    notify(c, room.master_id, `🤝 ${ch.sheet.name} передав ${itemName(item)} ×${n} → ${to.sheet.name}.`);
  },

  async spendMoney(c, { charId, money }) {
    const { ch, room } = await charAccess(c, charId, { owner: true });
    const d = sanitizeMoney(money);
    const m = ch.sheet.money;
    for (const k of R.COINS) if (d[k] > (m[k] || 0)) fail(`Недостатньо монет: ${R.COIN_FULL[k]}`);
    if (!R.COINS.some((k) => d[k] > 0)) fail('Вкажи суму');
    for (const k of R.COINS) m[k] = (m[k] || 0) - d[k];
    await saveSheet(c, ch);
    await evAct(c, room, ch, 'act', 1, { text: `витратив ${moneyStr(d)}` });
    await addLog(c, room, `витратив ${moneyStr(d)} (залишилось ${moneyStr(m)})`, charActor(c, ch));
    notify(c, room.master_id, `💰 ${ch.sheet.name} витратив ${moneyStr(d)}. Залишилось: ${moneyStr(m)}.`);
  },

  async giveMoney(c, { charId, toCharId, money }) {
    const { ch, room } = await charAccess(c, charId, { owner: true });
    const toRow = await first(c.db, 'SELECT * FROM characters WHERE id = ? AND alive = 1', int(toCharId, 0, 1e12, 0));
    const to = parseChar(toRow);
    if (!to || to.roomId !== room.id || to.id === ch.id) fail('Невірний отримувач');
    if (!(await isMember(c, room.id, to.userId))) fail('Отримувач уже не в кімнаті');
    const d = sanitizeMoney(money);
    const m = ch.sheet.money;
    for (const k of R.COINS) if (d[k] > (m[k] || 0)) fail(`Недостатньо монет: ${R.COIN_FULL[k]}`);
    if (!R.COINS.some((k) => d[k] > 0)) fail('Вкажи суму');
    for (const k of R.COINS) { m[k] = (m[k] || 0) - d[k]; to.sheet.money[k] = (to.sheet.money[k] || 0) + d[k]; }
    await saveSheet(c, ch);
    await saveSheet(c, to);
    await evAct(c, room, ch, 'act', 1, { text: `передав ${moneyStr(d)} → ${to.sheet.name}` });
    await addLog(c, room, `передав ${moneyStr(d)} → ${to.sheet.name}`, charActor(c, ch));
    notify(c, to.userId, `💰 ${ch.sheet.name} передав тобі ${moneyStr(d)}.`);
    notify(c, room.master_id, `💰 ${ch.sheet.name} передав ${moneyStr(d)} → ${to.sheet.name}.`);
  },

  async levelUp(c, { charId, hpMethod, asi, feat, expertise, subclassId, choices }) {
    const { ch, room } = await charAccess(c, charId, { owner: true });
    const s = ch.sheet;
    if (!(s.targetLevel > s.level)) fail('Майстер ще не дозволив підвищення рівня');
    if (s.level >= 20) fail('Максимальний рівень — 20');
    const oldLevel = s.level;
    const newLevel = oldLevel + 1;
    const cls = R.CLASSES[s.classId] || { hd: 8 };
    const parts = [];
    const oldCon = R.mod(s.abilities.con);
    const featuresBefore = Array.isArray(s.features) ? s.features.length : 0;
    // Нові вміння, підклас і вибори
    const errs = R.gainLevelFeatures(s, newLevel, { subclassId, choices });
    if (errs.length) fail(errs.join('\n'));
    // Підвищення характеристик або риса
    if (R.isAsiLevel(s.classId, newLevel)) {
      const inc = {};
      let sum = 0;
      for (const a of R.ABILITIES) { const v = int(asi && asi[a], 0, 2, 0); if (v) { inc[a] = v; sum += v; } }
      const wantFeat = feat && feat.id;
      if (sum && wantFeat) fail('Обери або підвищення характеристик, або рису — не обидва');
      if (wantFeat) {
        const fe = R.applyFeat(s, feat, newLevel, oldLevel);
        if (fe.length) fail(fe.join('\n'));
        parts.push(s.features[s.features.length - 1].name);
      } else if (sum) {
        if (sum !== 2) fail('Розподіли рівно 2 очки (+2 до однієї або +1 до двох характеристик)');
        for (const a of Object.keys(inc)) if (s.abilities[a] + inc[a] > 20) fail(`${R.ABILITY_NAMES[a]} не може перевищувати 20`);
        for (const a of Object.keys(inc)) s.abilities[a] += inc[a];
        parts.push(Object.keys(inc).map((a) => `${R.ABILITY_SHORT[a]} +${inc[a]}`).join(', '));
      } else fail('На цьому рівні обери підвищення характеристик або рису');
    }
    // Експертиза
    const expN = R.expertiseAt(s.classId, newLevel);
    if (expN) {
      const e = [...new Set(Array.isArray(expertise) ? expertise : [])].filter((k) => s.skills[k] === 1);
      if (e.length !== expN) fail(`Обери ${expN} навички для експертизи (з тих, якими володієш)`);
      for (const k of e) s.skills[k] = 2;
      parts.push(`експертиза: ${e.map((k) => R.SKILLS[k][0]).join(', ')}`);
    }
    parts.push(...R.levelEffects(s, newLevel));
    // Хіти («Міцний»: +2 за попередні рівні додано в applyFeat, за новий — через hpPerLevelBonus)
    const conMod = R.mod(s.abilities.con);
    const die = hpMethod === 'roll' ? R.rollDie(cls.hd) : R.hdAverage(cls.hd);
    const gain = Math.max(1, die + conMod + R.hpPerLevelBonus(s));
    const retro = (conMod - oldCon) * oldLevel;
    s.hp.max += gain + retro;
    s.hp.cur = Math.min(s.hp.max, s.hp.cur + gain + Math.max(0, retro));
    parts.unshift(`+${gain + retro} ХП (${hpMethod === 'roll' ? `кидок к${cls.hd}: ${die}` : `середнє к${cls.hd}: ${die}`}${conMod ? `, СТА ${R.fmtMod(conMod)}` : ''}${retro ? `, перерахунок СТА ${R.fmtMod(retro)}` : ''})`);
    s.level = newLevel;
    if (R.canSwapSpell(s)) s.spell.swaps = 1;
    if (R.isPreparedCaster(s)) s.spell.prepOpen = true;
    const freeSpells = R.spellPoolUsage(s, s.spell.spells).reduce((t, p) => t + Math.max(0, p.count - p.used), 0);
    if (freeSpells) parts.push(`можна обрати нові закляття (${freeSpells})`);
    const newFeatures = s.features.slice(featuresBefore).filter((x) => x.lvl === newLevel).map((x) => x.name);
    await saveSheet(c, ch);
    const msg = `підвищив рівень до ${newLevel}: ${parts.join('; ')}${newFeatures.length ? `. Нові вміння: ${newFeatures.join(', ')}` : ''}`;
    await addLog(c, room, msg, charActor(c, ch));
    notify(c, room.master_id, `⬆️ ${s.name} ${msg}.`);
    return { level: newLevel, hpGain: gain + retro, die, features: newFeatures };
  },

  async spendHitDie(c, { charId }) {
    const { ch, room } = await charAccess(c, charId, { owner: true });
    const s = ch.sheet;
    if (!R.shortRestActive(s, now())) fail('Кості хітів можна витрачати лише під час короткого відпочинку');
    if ((s.hitDiceUsed || 0) >= s.level) fail('Не залишилось костей хітів');
    if (s.hp.cur >= s.hp.max) fail('Хіти вже повні');
    const hd = (R.CLASSES[s.classId] || { hd: 8 }).hd;
    const conMod = R.mod(s.abilities.con);
    const roll = R.rollDie(hd);
    let heal = Math.max(0, roll + conMod);
    if ((s.feats || []).includes('durable')) heal = Math.max(heal, 2 * conMod);
    const before = s.hp.cur;
    s.hp.cur = Math.min(s.hp.max, s.hp.cur + heal);
    s.hitDiceUsed = (s.hitDiceUsed || 0) + 1;
    await saveSheet(c, ch);
    await evAct(c, room, ch, 'heal', s.hp.cur - before);
    await evAct(c, room, ch, 'act', 1, { text: `витратив кість хітів (к${hd})` });
    await addLog(c, room, `витратив кість хітів (к${hd}: ${roll}${conMod ? ` ${R.fmtMod(conMod)}` : ''}): ХП ${before} → ${s.hp.cur}`, charActor(c, ch));
    return { roll, heal: s.hp.cur - before, left: s.level - s.hitDiceUsed };
  },

  async endShortRest(c, { charId }) {
    const { ch } = await charAccess(c, charId, { owner: true, master: true });
    if (!ch.sheet.shortRest) return;
    ch.sheet.shortRest = null;
    await saveSheet(c, ch);
    await bumpRoom(c, ch.roomId);
  },

  // ----- Майстер -----
  async masterSaveSheet(c, { charId, sheet }) {
    const { ch, room } = await charAccess(c, charId, { master: true });
    const old = ch.sheet;
    const s = sanitizeSheetByMaster(sheet, old);
    const diff = describeSheetDiff(old, s);
    if (!diff.length) return { ok: true, changed: 0 };
    ch.sheet = s;
    await saveSheet(c, ch);
    await addLog(c, room, `змінив персонажа ${s.name}: ${diff.join('; ')}`);
    notify(c, ch.userId, `🎲 Майстер змінив твого персонажа ${s.name}:\n• ${diff.join('\n• ')}`);
    return { ok: true, changed: diff.length };
  },

  async masterAddItem(c, { charId, item, qty }) {
    const { ch, room } = await charAccess(c, charId, { master: true });
    const data = sanitizeItem(item);
    const n = int(qty, 1, 99999, 1);
    await addItemToChar(c, ch.id, data, n);
    await addLog(c, room, `видав «${data.name}» ×${n} → ${ch.sheet.name}`);
    notify(c, ch.userId, `🎁 Майстер видав тобі «${data.name}» ×${n} (${R.RARITIES[data.rarity].name.toLowerCase()}).`);
  },

  async masterEditItem(c, { itemId, item, qty }) {
    const { item: it, ch, room } = await itemAccess(c, itemId, { master: true });
    const parts = [];
    if (item) {
      const data = sanitizeItem(item);
      if (JSON.stringify(data) !== JSON.stringify(it.data)) {
        await run(c.db, 'UPDATE items SET data = ? WHERE id = ?', JSON.stringify(data), it.id);
        parts.push(data.name !== it.data.name ? `перейменовано на «${data.name}»` : 'змінено властивості');
      }
    }
    if (qty !== undefined) {
      const n = int(qty, 0, 99999, it.qty);
      if (n !== it.qty) {
        if (n === 0) await run(c.db, 'DELETE FROM items WHERE id = ?', it.id);
        else await run(c.db, 'UPDATE items SET qty = ? WHERE id = ?', n, it.id);
        parts.push(`кількість ${it.qty} → ${n}`);
      }
    }
    if (!parts.length) return;
    await addLog(c, room, `${itemName(it)} у ${ch.sheet.name}: ${parts.join(', ')}`);
    notify(c, ch.userId, `🎲 Майстер змінив предмет ${itemName(it)}: ${parts.join(', ')}.`);
  },

  async masterRemoveItem(c, { itemId }) {
    const { item, ch, room } = await itemAccess(c, itemId, { master: true });
    await run(c.db, 'DELETE FROM items WHERE id = ?', item.id);
    await addLog(c, room, `забрав ${itemName(item)} ×${item.qty} у ${ch.sheet.name}`);
    notify(c, ch.userId, `🎲 Майстер забрав у тебе ${itemName(item)} ×${item.qty}.`);
  },

  async masterMoney(c, { charId, money }) {
    const { ch, room } = await charAccess(c, charId, { master: true });
    const old = { ...ch.sheet.money };
    ch.sheet.money = sanitizeMoney(money);
    if (JSON.stringify(sanitizeMoney(old)) === JSON.stringify(ch.sheet.money)) return;
    await saveSheet(c, ch);
    await addLog(c, room, `гроші ${ch.sheet.name}: ${moneyStr(old)} → ${moneyStr(ch.sheet.money)}`);
    notify(c, ch.userId, `💰 Майстер змінив твої гроші: ${moneyStr(old)} → ${moneyStr(ch.sheet.money)}.`);
  },

  async masterXP(c, { charId, amount }) {
    const { ch, room } = await charAccess(c, charId, { master: true });
    const n = int(amount, -1e7, 1e7, 0);
    if (!n) fail('Вкажи кількість досвіду');
    await giveXp(c, ch, n);
    await addLog(c, room, `${n > 0 ? '+' : ''}${n} досвіду → ${ch.sheet.name} (всього ${ch.sheet.xp})`);
    return { xp: ch.sheet.xp, targetLevel: ch.sheet.targetLevel };
  },

  async masterGrantLevel(c, { charId }) {
    const { ch, room } = await charAccess(c, charId, { master: true });
    if (!(await giveLevel(c, ch))) fail('Вже 20 рівень');
    await addLog(c, room, `дозволив ${ch.sheet.name} підвищення до ${ch.sheet.targetLevel} рівня`);
    return { targetLevel: ch.sheet.targetLevel, xp: ch.sheet.xp };
  },

  // Досвід кожному обраному персонажу однаково
  async masterXPAll(c, { roomId, charIds, amount }) {
    const n = int(amount, -1e7, 1e7, 0);
    if (!n) fail('Вкажи кількість досвіду');
    const { room, chars } = await masterPicks(c, roomId, charIds);
    for (const ch of chars) await giveXp(c, ch, n);
    await addLog(c, room, `${n > 0 ? '+' : ''}${n} досвіду кожному: ${chars.map((ch) => ch.sheet.name).join(', ')}`);
    return { chars: chars.map((ch) => ({ id: ch.id, xp: ch.sheet.xp, targetLevel: ch.sheet.targetLevel })) };
  },
  // +1 рівень кожному обраному (від свого поточного); досвід підтягується до порогу нового рівня
  async masterGrantLevelAll(c, { roomId, charIds }) {
    const { room, chars } = await masterPicks(c, roomId, charIds);
    const done = [];
    for (const ch of chars) if (await giveLevel(c, ch)) done.push(ch);
    if (!done.length) fail('Усі обрані персонажі вже 20 рівня');
    await addLog(c, room, `дозволив підвищення рівня: ${done.map((ch) => `${ch.sheet.name} → ${ch.sheet.targetLevel}`).join(', ')}`);
    return { chars: done.map((ch) => ({ id: ch.id, xp: ch.sheet.xp, targetLevel: ch.sheet.targetLevel })), skipped: chars.length - done.length };
  },

  async masterSetAlive(c, { charId, alive }) {
    const { ch, room } = await charAccess(c, charId, { master: true, alive: false });
    const want = !!alive;
    if (want === ch.alive) return;
    if (want) {
      const other = await first(c.db, 'SELECT 1 AS x FROM characters WHERE room_id = ? AND user_id = ? AND alive = 1', room.id, ch.userId);
      if (other) fail('У гравця вже є інший живий персонаж');
    }
    // смерть і повернення до життя — у підсумок сесії
    if (want) await snapChar(c, room, { id: ch.id, sheet: ch.sheet });
    else await ensureSnaps(c, room);
    await run(c.db, 'UPDATE characters SET alive = ?, updated_at = ? WHERE id = ?', want ? 1 : 0, now(), ch.id);
    await snapMark(c, room, ch.id, want ? 'revived' : 'died');
    await addLog(c, room, want ? `повернув до життя ${ch.sheet.name}` : `☠ ${ch.sheet.name} загинув`);
    notify(c, ch.userId, want
      ? `✨ Майстер повернув до життя ${ch.sheet.name}!`
      : `☠ Твій персонаж ${ch.sheet.name} загинув. Відкрий застосунок, щоб створити нового.`);
  },

  async masterRest(c, { roomId, charId, kind }) {
    if (!['short', 'long'].includes(kind)) fail('Невідомий тип відпочинку');
    let room;
    let chars;
    if (charId) {
      const a = await charAccess(c, charId, { master: true });
      room = a.room;
      chars = [a.ch];
    } else {
      room = await requireMaster(c, roomId);
      chars = (await all(c.db, `SELECT ch.* FROM characters ch JOIN members m ON m.room_id = ch.room_id AND m.user_id = ch.user_id
        WHERE ch.room_id = ? AND ch.alive = 1`, room.id)).map(parseChar);
    }
    if (!chars.length) fail('Немає персонажів для відпочинку');
    const t = now();
    for (const ch of chars) {
      const res = R.applyRest(ch.sheet, kind, t);
      await saveSheet(c, ch);
      const left = ch.sheet.level - (ch.sheet.hitDiceUsed || 0);
      notify(c, ch.userId, kind === 'long'
        ? `🌙 Довгий відпочинок: ${ch.sheet.name} — хіти, комірки заклять і ресурси відновлено.${R.isPreparedCaster(ch.sheet) ? ' Можеш змінити підготовлені закляття.' : ''}`
        : `☕ Короткий відпочинок! ${res.length ? `Відновлено: ${res.join(', ')}. ` : ''}Можеш витратити кості хітів у застосунку (доступно ${left}).`);
    }
    await addLog(c, room, `${kind === 'long' ? '🌙 довгий' : '☕ короткий'} відпочинок: ${chars.map((x) => x.sheet.name).join(', ')}`);
    return { count: chars.length };
  },

  async masterFeatures(c, { charId, features }) {
    const { ch, room } = await charAccess(c, charId, { master: true });
    if (!Array.isArray(features) || features.length > 300) fail('Невірний список вмінь');
    const old = JSON.parse(JSON.stringify(ch.sheet));
    ch.sheet.features = features.map((x) => ({
      lvl: int(x.lvl, 1, 20, 1), name: str(x.name, 100) || fail('У вміння має бути назва'), desc: str(x.desc, 800),
      src: ['race', 'class', 'subclass', 'choice', 'feat', 'custom'].includes(x.src) ? x.src : 'custom',
    }));
    const diff = describeSheetDiff(old, ch.sheet);
    if (!diff.length) return;
    await saveSheet(c, ch);
    await addLog(c, room, `${ch.sheet.name}: ${diff.join('; ')}`);
    notify(c, ch.userId, `🎲 Майстер змінив вміння ${ch.sheet.name}: ${diff.join('; ')}`);
  },

  async logList(c, { roomId, all: wantAll }) {
    const room = await requireMaster(c, roomId);
    const rows = wantAll
      ? await all(c.db, 'SELECT * FROM logs WHERE room_id = ? ORDER BY id DESC LIMIT 500', room.id)
      : await all(c.db, 'SELECT * FROM logs WHERE room_id = ? AND session = ? ORDER BY id DESC LIMIT 500', room.id, room.session);
    const entries = rows.map((r) => ({ id: r.id, ts: r.ts, session: r.session, actor: r.actor, text: r.text }));
    // завершені сесії — стислим підсумком (детальний журнал після завершення видаляється)
    if (wantAll) {
      for (const sm of await roomSummaries(c, room)) entries.push({ id: `s${sm.id}`, ts: sm.ts, session: sm.session, summary: renderSummary(c.user.lang, room, sm.data) });
      entries.sort((x, y) => y.session - x.session || (y.summary ? 1 : 0) - (x.summary ? 1 : 0) || y.ts - x.ts);
    }
    return { session: room.session, entries };
  },

  async exportLog(c, { roomId, all: wantAll }) {
    const room = await requireMaster(c, roomId);
    const txt = await buildLogTxt(c, room, wantAll ? null : room.session);
    const fname = `${room.name.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40)}_${wantAll ? 'povnyi' : 'sesiia_' + room.session}.txt`;
    const r = await sendDocument(c.env, c.user.id, fname, txt, tr(c.user.lang, `📜 Журнал «${room.name}»${wantAll ? '' : `, сесія ${room.session}`}`));
    if (!r.ok) fail('Не вдалося надіслати файл. Відкрий чат із ботом, натисни «Почати» (Start) і спробуй ще раз.');
    return { sent: true };
  },

  // Завершення сесії: активні події закриваються, усе стискається до підсумку (рівень, досвід, гроші, предмети, ХП, натхнення,
  // смерті + перелік подій). Підсумок зберігається й приходить майстрові одним файлом, а детальний журнал, кидки й записи подій видаляються.
  async endSession(c, { roomId }) {
    const room = await requireMaster(c, roomId);
    for (const ev of await activeEvents(c, room)) await finishEvent(c, room, ev, { silent: true });
    const sm = await buildSessionSummary(c, room);
    await run(c.db, 'INSERT INTO session_summaries (room_id, session, ts, data) VALUES (?, ?, ?, ?)', room.id, room.session, sm.end, JSON.stringify(sm));
    const txt = renderSummary(c.user.lang, room, sm).join('\r\n');
    const fname = `${room.name.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40)}_pidsumok_sesii_${room.session}.txt`;
    const r = await sendDocument(c.env, c.user.id, fname, txt, tr(c.user.lang, `📜 Підсумок сесії ${room.session} «${room.name}»`));
    const evq = 'SELECT id FROM events WHERE room_id = ? AND session = ?';
    await c.db.batch([
      q(c.db, 'DELETE FROM logs WHERE room_id = ? AND session = ?', room.id, room.session),
      q(c.db, `DELETE FROM event_acts WHERE event_id IN (${evq})`, room.id, room.session),
      q(c.db, `DELETE FROM event_members WHERE event_id IN (${evq})`, room.id, room.session),
      q(c.db, `DELETE FROM combatants WHERE event_id IN (${evq})`, room.id, room.session),
      q(c.db, 'DELETE FROM events WHERE room_id = ? AND session = ?', room.id, room.session),
      // гравцям лишається лише історія останніх кидків на листі
      q(c.db, `DELETE FROM dice_rolls WHERE room_id = ? AND id NOT IN (SELECT id FROM
        (SELECT id, ROW_NUMBER() OVER (PARTITION BY char_id ORDER BY id DESC) AS rn FROM dice_rolls WHERE room_id = ?) WHERE rn <= ?)`, room.id, room.id, DICE_HISTORY),
      q(c.db, 'DELETE FROM char_snaps WHERE room_id = ? AND session = ?', room.id, room.session),
      q(c.db, 'UPDATE rooms SET session = session + 1, version = version + 1 WHERE id = ?', room.id),
    ]);
    room.session += 1;
    c.evc = null;
    await ensureSnaps(c, room);
    const members = await all(c.db, 'SELECT user_id FROM members WHERE room_id = ?', room.id);
    for (const m of members) notify(c, m.user_id, `🏁 «${room.name}»\nНа сьогодні подорож завершена... До наступної зустрічі!`);
    return { sent: !!r.ok, session: room.session };
  },
};

export { OPS };
