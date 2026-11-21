// Мовний рушій DnD Companion. Вихідна мова — українська; словник перекладу: { 'український текст': 'переклад' }.
// Ключі можуть містити змінні {0}, {name} (будь-який текст, перекладається рекурсивно) і # (число).
// Складені рядки («А: Б; В», «Назва ×2», «⚠️ Текст») розбираються на частини; з кількох варіантів
// обирається той, що лишає найменше неперекладеного тексту.
export const LANGS = [['uk', 'UA'], ['ru', 'RU'], ['en', 'EN']];
export const LOCALES = { uk: 'uk-UA', ru: 'ru-RU', en: 'en-GB' };
export const normLang = (l) => (l === 'ru' || l === 'en' ? l : 'uk');
// мова Telegram → мова застосунку (для нових користувачів)
export const langFromTg = (code) => { const c = String(code || '').toLowerCase().slice(0, 2); return c === 'uk' ? 'uk' : ['ru', 'be', 'kk'].includes(c) ? 'ru' : c ? 'en' : 'uk'; };
// Скорочення мовою інтерфейсу (ключ — українське скорочення з глосарію)
export const ABBR_LOC = {
  ru: { 'СИЛ': 'СИЛ', 'СПР': 'ЛОВ', 'СТА': 'ТЕЛ', 'ІНТ': 'ИНТ', 'МДР': 'МДР', 'ХАР': 'ХАР', 'КЗ': 'КД', 'ХП': 'ХП', 'ПН': 'ПО', 'СК': 'Сл', 'ПМ': 'ПМ', 'ЗМ': 'ЗМ', 'ЕМ': 'ЭМ', 'СМ': 'СМ', 'ММ': 'ММ', 'фнт': 'фнт', 'фт': 'фт', 'хв': 'мин', 'год': 'ч', 'мод.': 'мод.', 'рів.': 'ур.', 'макс.': 'макс.', 'тимч.': 'врем.', 'Ініціат.': 'Инициат.', 'Швидк.': 'Скор.', 'Майст.': 'Маст.', 'Дод.': 'Доп.', 'експ.': 'комп.', 'кост.': 'кост.', 'К': 'К', 'Р': 'Р', 'В': 'В', 'С': 'С', 'М': 'М' },
  en: { 'СИЛ': 'STR', 'СПР': 'DEX', 'СТА': 'CON', 'ІНТ': 'INT', 'МДР': 'WIS', 'ХАР': 'CHA', 'КЗ': 'AC', 'ХП': 'HP', 'ПН': 'CR', 'СК': 'DC', 'ПМ': 'pp', 'ЗМ': 'gp', 'ЕМ': 'ep', 'СМ': 'sp', 'ММ': 'cp', 'фнт': 'lb', 'фт': 'ft', 'хв': 'min', 'год': 'h', 'мод.': 'mod.', 'рів.': 'lvl', 'макс.': 'max', 'тимч.': 'temp.', 'Ініціат.': 'Init.', 'Швидк.': 'Speed', 'Майст.': 'Prof.', 'Дод.': 'Extra', 'експ.': 'exp.', 'кост.': 'HD', 'К': 'C', 'Р': 'R', 'В': 'V', 'С': 'S', 'М': 'M' },
};
const CYR = /[А-ЯҐЄІЇа-яґєії]/;
const CYR_G = /[А-ЯҐЄІЇа-яґєії]/g;
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s) => s.replace(/\s+/g, ' ');
const DICE_ONLY = /(\d*)к(100|20|12|10|8|6|4)(?![\p{L}\p{N}])/gu;
// скільки кириличних літер (позначення кісток «2к6» не враховуються)
const cyrLen = (s) => (s.replace(DICE_ONLY, '').match(CYR_G) || []).length;

function makeTpl(k, v) {
  // сусідні змінні {1}{2} без тексту між ними — одна змінна, якщо в перекладі вони так само поруч
  for (const run of k.match(/(?:\{\w+\}){2,}/g) || []) {
    if (v.includes(run)) { const one = run.match(/\{\w+\}/)[0]; k = k.replace(run, one); v = v.replace(run, one); }
  }
  const names = [];
  let lit = 0;
  const parts = k.split(/(\{\w+\}|#)/);
  const src = parts.map((p, i) => {
    // змінна в самому кінці може бути порожньою («…»{1} без доповнення)
    if (/^\{\w+\}$/.test(p)) { names.push(p.slice(1, -1)); return i === parts.length - 2 && parts[i + 1] === '' && i > 0 ? '([\\s\\S]*?)' : '([\\s\\S]+?)'; }
    if (p === '#') { names.push('#'); return '([+−-]?\\d+(?:[.,]\\d+)?)'; }
    lit += p.length;
    return escRe(p);
  }).join('');
  // сталі шматки, які мають бути в рядку, — швидка перевірка перед регулярним виразом
  const need = parts.filter((p, i) => i % 2 === 0 && p.trim()).map((p) => p.trim());
  // мало сталого тексту («до {0}», «{0} фт») — змінні мають бути числами або перекладеними назвами
  const short = parts.filter((p, i) => i % 2 === 0).join('').replace(/[^\p{L}]/gu, '').length <= 5;
  return { re: new RegExp(`^${src}$`), names, v, lit, need, k, short };
}

// Підготовка словника до використання
export function compile(dict, lang) {
  const map = new Map();
  const num = new Map();
  const tpls = [];
  for (const [k0, v] of Object.entries(dict || {})) {
    const k = norm(k0).trim();
    if (!k || v == null) continue;
    if (/\{\w+\}/.test(k)) tpls.push(makeTpl(k, v));
    else if (k.includes('#')) { num.set(k, v); tpls.push(makeTpl(k, v)); } else map.set(k, v);
  }
  // спершу найконкретніші шаблони (більше сталого тексту)
  tpls.sort((a, b) => b.lit - a.lit);
  return { lang, map, num, tpls, cache: new Map() };
}

const DICE_RE = /(\d*)к(100|20|12|10|8|6|4)(?![\p{L}\p{N}])/gu;
function post(D, s) {
  return D.lang === 'en' ? s.replace(DICE_RE, '$1d$2') : s;
}

// Результат перекладу: r — текст, f — скільки кириличних літер лишилось неперекладеними (0 — повністю)
const OK = (r) => ({ r, f: 0 });
// схоже на ім’я чи назву (до трьох слів, з великої літери) — може лишатися без перекладу
const NAME_LIKE = /^[«"]?[\p{Lu}\d][^\s]*(?: [^\s]+){0,2}$/u;
const Q = { en: ['“', '”'], ru: ['«', '»'] };

function viaTemplates(D, core, depth) {
  let best = null;
  for (const t of D.tpls) {
    if (!t.need.every((x) => core.includes(x))) continue;
    const m = t.re.exec(core);
    if (!m) continue;
    const vals = {};
    const ns = [];
    let f = 0;
    let wrong = false;
    for (let i = 0; i < t.names.length && !wrong; i++) {
      const n = t.names[i];
      const raw = m[i + 1];
      if (n === '#') { ns.push(raw); continue; }
      const x = tr(D, raw, depth + 1);
      if (x.f) {
        const cnt = (c) => raw.split(c).length;
        // змінна захопила неперекладений шматок речення — шаблон не той
        if ((t.short && !NAME_LIKE.test(raw)) || /[;:]|^[\s,.)]|[\s,(]$/.test(raw) || cnt('(') !== cnt(')') || cnt('«') !== cnt('»')) wrong = true;
      }
      f += x.f;
      vals[n] = x.r;
    }
    if (wrong) continue;
    let j = 0;
    const r = t.v.replace(/\{(\w+)\}|#/g, (x, n) => (n ? (vals[n] ?? x) : (ns[j++] ?? x)));
    if (!f) { if (D.hits) D.hits.add(`${t.k} ⇐ ${core}`); return OK(r); }
    if (!best || f < best.f) best = { r, f, k: t.k };
  }
  return best;
}

// Розбір складених рядків; повертає варіанти (перший повний — одразу)
function* splits(D, core, depth) {
  const sub = (s) => tr(D, s, depth + 1);
  const join = (parts, sep) => { const xs = parts.map(sub); return { r: xs.map((x) => x.r).join(sep), f: xs.reduce((a, x) => a + x.f, 0) }; };
  // назва з малої літери («обери: магічна традиція»)
  const c0 = core[0];
  if (c0 !== c0.toUpperCase() && CYR.test(c0)) {
    const tc = D.map.get(c0.toUpperCase() + core.slice(1));
    if (tc !== undefined) yield OK(D.lang !== 'en' || !/\s[A-Z]/.test(tc) ? tc[0].toLowerCase() + tc.slice(1) : tc);
  }
  // символи на початку: «⚠️ …», «📖 …», «＋ …», «(а) …»
  const lead = /^((?:[^\p{L}\p{N}«(]|\([\p{L}]\))+\s*)(\p{L}[\s\S]*)$/u.exec(core);
  if (lead) { const x = sub(lead[2]); yield { r: lead[1] + x.r, f: x.f }; }
  // у лапках
  const qm = /^«([^«»]+)»$/.exec(core);
  if (qm) { const x = sub(qm[1]); const [a, b] = Q[D.lang] || Q.ru; yield { r: a + x.r + b, f: x.f }; }
  // увесь текст у дужках
  const pw = /^\(([^()]+)\)$/.exec(core);
  if (pw) { const x = sub(pw[1]); yield { r: `(${x.r})`, f: x.f }; }
  // списки й речення
  if (core.includes('; ')) yield join(core.split('; '), '; ');
  const sre = /[.!?] (?=[^\s\p{Ll}])/gu;
  let sm;
  let ns = 0;
  while ((sm = sre.exec(core)) && ns++ < 6) {
    const si = sm.index;
    const a = core.slice(0, si + 1);
    let xa = sub(a);
    if (xa.f && a.endsWith('.')) { const y = sub(a.slice(0, -1)); if (y.f < xa.f) xa = { r: `${y.r}.`, f: y.f }; }
    const xb = sub(core.slice(si + 2));
    yield { r: `${xa.r} ${xb.r}`, f: xa.f + xb.f };
  }
  const ci = core.indexOf(': ');
  if (ci > 0) { const xa = sub(core.slice(0, ci)); const xb = sub(core.slice(ci + 2)); yield { r: `${xa.r}: ${xb.r}`, f: xa.f + xb.f }; }
  for (const sep of [' · ', ' — ', ' + ', ' → ']) if (core.includes(sep)) yield join(core.split(sep), sep);
  // «Назва (уточнення)»
  const pm = /^(.+?) \(([^()]+)\)$/.exec(core);
  if (pm) { const xa = sub(pm[1]); const xb = sub(pm[2]); yield { r: `${xa.r} (${xb.r})`, f: xa.f + xb.f }; }
  // «СТА +1», «Стріла ×20», «Замовляння 2/3», «1к6 дробильна»
  const nf = /^([+−-]?[\dк×+−-]*\d[\dк×+−-]*) (.+)$/.exec(core);
  if (nf && !/[^\dк×+−-]/.test(nf[1])) { const x = sub(nf[2]); yield { r: `${nf[1]} ${x.r}`, f: x.f }; }
  const nl = /^(.+?) (×?[+−-]?\d+(?:[.,/]\d+)*)$/.exec(core);
  if (nl) { const x = sub(nl[1]); yield { r: `${x.r} ${nl[2]}`, f: x.f }; }
  if (core.includes(', ')) yield join(core.split(', '), ', ');
}

function tr(D, s, depth) {
  if (!CYR.test(s)) return OK(s);
  if (!cyrLen(s)) return OK(post(D, s));
  if (depth > 8) return { r: s, f: cyrLen(s) };
  const cached = D.cache.get(s);
  if (cached !== undefined) return cached;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  let res;
  if (m[2].includes('\n') && !D.map.has(norm(m[2]))) {
    // кілька рядків — по одному
    const xs = m[2].split('\n').map((x) => tr(D, x, depth));
    res = { r: xs.map((x) => x.r).join('\n'), f: xs.reduce((a, x) => a + x.f, 0) };
  } else {
    const core = norm(m[2]);
    res = attempt(D, core, depth);
    if (!res) res = { r: core === m[2] ? m[2] : core, f: cyrLen(core) };
  }
  res = { r: post(D, m[1] + res.r + m[3]), f: res.f };
  if (D.cache.size > 30000) D.cache.clear();
  D.cache.set(s, res);
  return res;
}

function attempt(D, core, depth) {
  const hit = D.map.get(core);
  if (hit !== undefined) return OK(hit);
  // числа → #
  const nums = [];
  const nk = core.replace(/\d+(?:[.,]\d+)?/g, (x) => { nums.push(x); return '#'; });
  if (nums.length && D.num.has(nk)) { let i = 0; return OK(D.num.get(nk).replace(/#/g, () => nums[i++] ?? '')); }
  let best = viaTemplates(D, core, depth);
  if (best && !best.f) return best;
  const total = cyrLen(core);
  for (const x of splits(D, core, depth)) {
    if (!x.f) return x;
    if (x.f < total && (!best || x.f < best.f)) best = x;
  }
  return best && best.f < total ? best : null;
}

// Переклад рядка (порожній словник — без змін)
export function translate(D, s) {
  if (!D || s == null) return s;
  s = String(s);
  if (!CYR.test(s)) return s;
  const x = tr(D, s, 0);
  if (x.f && D.missing) D.missing.add(norm(s).trim());
  return x.r;
}
export const hasCyr = (s) => CYR.test(String(s || ''));
