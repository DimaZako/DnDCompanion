// Правила D&D 5e (SRD 5.1, CC-BY-4.0), спільні для Mini App і сервера.
import { CLASS_DATA, FEATS, RACE_TRAITS, RACE_CHOICES, PACT_BOONS, resourceDefs } from './classdata.js';
import { SPELLS, SPELL_IDS as SPELL_ORDER, DOMAIN_SPELLS, OATH_SPELLS, LAND_SPELLS, PATRON_SPELLS } from './spells.js';
import { buildProf, grantProf, weaponProficient, SUBCLASS_PROF, FEAT_PROF, RACE_PROF, LANGUAGES } from './gear.js';
import { RACE_DATA, RACE_GROUPS } from './races.js';
export * from './gear.js';
export { SPELLS, SPELL_IDS, spellDuration, SPELL_LIST_NAMES } from './spells.js';
export { CLASS_DATA, FEATS };

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ABILITY_NAMES = {
  str: 'Сила', dex: 'Спритність', con: 'Статура',
  int: 'Інтелект', wis: 'Мудрість', cha: 'Харизма',
};
export const ABILITY_SHORT = { str: 'СИЛ', dex: 'СПР', con: 'СТА', int: 'ІНТ', wis: 'МДР', cha: 'ХАР' };

export const SKILLS = {
  acrobatics: ['Акробатика', 'dex'],
  animal: ['Поводження з тваринами', 'wis'],
  arcana: ['Магія', 'int'],
  athletics: ['Атлетика', 'str'],
  deception: ['Обман', 'cha'],
  history: ['Історія', 'int'],
  insight: ['Проникливість', 'wis'],
  intimidation: ['Залякування', 'cha'],
  investigation: ['Розслідування', 'int'],
  medicine: ['Медицина', 'wis'],
  nature: ['Природа', 'int'],
  perception: ['Уважність', 'wis'],
  performance: ['Виступ', 'cha'],
  persuasion: ['Переконання', 'cha'],
  religion: ['Релігія', 'int'],
  sleight: ['Спритність рук', 'dex'],
  stealth: ['Непомітність', 'dex'],
  survival: ['Виживання', 'wis'],
};
// У алфавітному порядку назви мовою інтерфейсу (типово українською)
let skillCmp = (a, b) => SKILLS[a][0].localeCompare(SKILLS[b][0], 'uk');
export const SKILL_IDS = Object.keys(SKILLS).sort((a, b) => skillCmp(a, b));
export const sortSkills = (ids) => ids.slice().sort((a, b) => skillCmp(a, b));
// Перевпорядкувати навички й закляття за перекладеними назвами (tr — функція перекладу)
export function setNameOrder(tr, locale) {
  skillCmp = (a, b) => tr(SKILLS[a][0]).localeCompare(tr(SKILLS[b][0]), locale);
  SKILL_IDS.sort((a, b) => skillCmp(a, b));
  SPELL_ORDER.sort((a, b) => SPELLS[a].level - SPELLS[b].level || tr(SPELLS[a].name).localeCompare(tr(SPELLS[b].name), locale));
}

// caster: full | half | pact | none
export const CLASSES = {
  barbarian: { name: 'Варвар', hd: 12, saves: ['str', 'con'], skillCount: 2,
    skills: ['animal', 'athletics', 'intimidation', 'nature', 'perception', 'survival'], caster: 'none', unarmored: 'con' },
  bard: { name: 'Бард', hd: 8, saves: ['dex', 'cha'], skillCount: 3, skills: 'any', caster: 'full', spellAbility: 'cha',
    expertise: { 3: 2, 10: 2 } },
  cleric: { name: 'Жрець', hd: 8, saves: ['wis', 'cha'], skillCount: 2,
    skills: ['history', 'insight', 'medicine', 'persuasion', 'religion'], caster: 'full', spellAbility: 'wis' },
  druid: { name: 'Друїд', hd: 8, saves: ['int', 'wis'], skillCount: 2,
    skills: ['arcana', 'animal', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'], caster: 'full', spellAbility: 'wis' },
  fighter: { name: 'Воїн', hd: 10, saves: ['str', 'con'], skillCount: 2,
    skills: ['acrobatics', 'animal', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'], caster: 'none',
    extraAsi: [6, 14] },
  monk: { name: 'Монах', hd: 8, saves: ['str', 'dex'], skillCount: 2,
    skills: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'], caster: 'none', unarmored: 'wis' },
  paladin: { name: 'Паладин', hd: 10, saves: ['wis', 'cha'], skillCount: 2,
    skills: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'], caster: 'half', spellAbility: 'cha' },
  ranger: { name: 'Слідопит', hd: 10, saves: ['str', 'dex'], skillCount: 3,
    skills: ['animal', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'], caster: 'half', spellAbility: 'wis' },
  rogue: { name: 'Пройдисвіт', hd: 8, saves: ['dex', 'int'], skillCount: 4,
    skills: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight', 'stealth'],
    caster: 'none', extraAsi: [10], expertise: { 1: 2, 6: 2 } },
  sorcerer: { name: 'Чародій', hd: 6, saves: ['con', 'cha'], skillCount: 2,
    skills: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'], caster: 'full', spellAbility: 'cha' },
  warlock: { name: 'Чаклун', hd: 8, saves: ['wis', 'cha'], skillCount: 2,
    skills: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'], caster: 'pact', spellAbility: 'cha' },
  wizard: { name: 'Маг', hd: 6, saves: ['int', 'wis'], skillCount: 2,
    skills: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'], caster: 'full', spellAbility: 'int' },
};

// bonus: фіксовані бонуси; choose: {count, amount, exclude} — бонуси на вибір
export const RACES = {
  hill_dwarf: { name: 'Дварф (пагорбовий)', speed: 25, bonus: { con: 2, wis: 1 }, hpPerLevel: 1 },
  high_elf: { name: 'Ельф (високий)', speed: 30, bonus: { dex: 2, int: 1 }, skills: ['perception'] },
  lightfoot_halfling: { name: 'Напіврослик (легконогий)', speed: 25, bonus: { dex: 2, cha: 1 } },
  human: { name: 'Людина', speed: 30, bonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 } },
  dragonborn: { name: 'Драконороджений', speed: 30, bonus: { str: 2, cha: 1 } },
  rock_gnome: { name: 'Гном (скельний)', speed: 25, bonus: { int: 2, con: 1 } },
  half_elf: { name: 'Напівельф', speed: 30, bonus: { cha: 2 }, choose: { count: 2, amount: 1, exclude: ['cha'] }, skillChoice: 2 },
  half_orc: { name: 'Напіворк', speed: 30, bonus: { str: 2, con: 1 }, skills: ['intimidation'] },
  tiefling: { name: 'Тифлінг', speed: 30, bonus: { cha: 2, int: 1 } },
};
for (const r of Object.values(RACES)) r.group = 'phb';
export { RACE_GROUPS, RACE_DATA, RACE_TRAITS };
// Додаткові раси з shared/races.js: базові поля для вибору й створення
for (const [id, d] of Object.entries(RACE_DATA)) {
  RACES[id] = { name: d.n, speed: d.speed || 30, bonus: d.asi && d.asi !== 'flex' ? d.asi : {}, flex: d.asi === 'flex', choose: d.choose, skills: d.skills,
    skillChoice: d.skillChoice, hpPerLevel: d.hpLvl, group: d.g, src: d.src };
}
export const raceData = (sheet) => RACE_DATA[sheet && sheet.raceId] || null;
const SIZE_N = { S: 'Малий', M: 'Середній' };
const speedVal = (v, walk) => (v === true ? walk : Number(v) || 0);
// риси, що випливають із полів раси: розмір, тип, швидкості, темний зір, мови
function autoRaceTraits(d) {
  const out = [];
  if (d.size === 'S') out.push(['Розмір', 'Малий.']);
  if (d.size === 'SM') out.push(['Розмір', 'Малий або Середній — на вибір.']);
  if (d.type && d.type !== 'Гуманоїд') out.push(['Тип істоти', `${d.type}.`]);
  const walk = d.speed || 30;
  const extra = [['fly', 'політ'], ['swim', 'плавання'], ['climb', 'лазіння'], ['burrow', 'риття']].filter(([k]) => d[k]).map(([k, n]) => `${n} ${speedVal(d[k], walk)} фт`);
  if (walk !== 30 || extra.length) out.push(['Швидкість', `${walk} фт${extra.length ? `; ${extra.join('; ')}` : ''}.`]);
  if (d.dark) out.push(['Темний зір', `Бачиш у темряві на ${d.dark} фт як у тьмяному світлі.`]);
  if (d.langs) out.push(['Мови', `${d.langs.map((l) => LANGUAGES[l] || l).join(', ')}${d.lang ? ` + ${d.lang} на вибір` : ''}`]);
  return out;
}
for (const [id, d] of Object.entries(RACE_DATA)) {
  const own = new Set(d.tr.map(([n]) => n));
  RACE_TRAITS[id] = [...autoRaceTraits(d).filter(([n]) => !own.has(n)), ...d.tr];
  RACE_PROF[id] = { armor: d.armor, weapons: d.weapons, tools: d.tools, tool: d.tool, languages: d.langs, lang: d.lang };
  const specs = [];
  (d.pick || []).forEach((p, i) => specs.push({ id: `raceSkill${i || ''}`, name: 'Навички раси', kind: 'skill', from: p.from === 'any' ? undefined : p.from, total: { 1: p.n }, src: 'race' }));
  if (d.size === 'SM') specs.push({ id: 'raceSize', name: 'Розмір', total: { 1: 1 }, options: [{ id: 'S', name: 'Малий' }, { id: 'M', name: 'Середній' }], src: 'race' });
  for (const c of d.choices || []) {
    if (c.ref === 'dragon') { specs.push({ ...RACE_CHOICES.dragonborn[0] }); continue; }
    const options = c.addSkills ? [...c.options, ...SKILL_IDS.map((k) => ({ id: `sk_${k}`, name: `Навичка: ${SKILLS[k][0]}`, skills: [k] }))] : c.options;
    specs.push({ total: { 1: 1 }, ...c, options, src: 'race' });
  }
  if (d.feat) specs.push({ id: 'raceFeat', name: 'Риса', kind: 'feat', total: { 1: 1 }, src: 'race' });
  if (specs.length) RACE_CHOICES[id] = specs;
}
// швидкості раси (політ, плавання, лазіння, риття) з урахуванням виборів
export function raceSpeeds(sheet) {
  const d = raceData(sheet);
  const out = {};
  if (!d) return out;
  const walk = Number(sheet.speed) || d.speed || 30;
  for (const k of ['fly', 'swim', 'climb', 'burrow']) if (d[k]) out[k] = speedVal(d[k], walk);
  const ch = sheet.choices || {};
  if ((ch.simicBase || []).includes('climber')) out.climb = walk;
  if ((ch.simicBase || []).includes('underwater')) out.swim = walk;
  return out;
}
// природна зброя раси — як предмети з від’ємними id
export function naturalWeapons(sheet) {
  const d = raceData(sheet);
  return ((d && d.nat) || []).map((w, i) => ({ id: -(i + 1), qty: 1, d: { name: w.n, type: 'weapon', damage: w.d, dmgType: w.t, natural: true, ability: w.ab || '' } }));
}
export const initMod = (sheet) => mod(sheet.abilities.dex) + (Number(sheet.initBonus) || 0) + ((raceData(sheet) || {}).initProf ? sheetProf(sheet) : 0);

export const BACKGROUNDS = {
  acolyte: { name: 'Прислужник', skills: ['insight', 'religion'] },
  charlatan: { name: 'Шарлатан', skills: ['deception', 'sleight'] },
  criminal: { name: 'Злочинець', skills: ['deception', 'stealth'] },
  entertainer: { name: 'Артист', skills: ['acrobatics', 'performance'] },
  folk_hero: { name: 'Народний герой', skills: ['animal', 'survival'] },
  guild_artisan: { name: 'Гільдійний ремісник', skills: ['insight', 'persuasion'] },
  hermit: { name: 'Відлюдник', skills: ['medicine', 'religion'] },
  noble: { name: 'Шляхтич', skills: ['history', 'persuasion'] },
  outlander: { name: 'Чужинець', skills: ['athletics', 'survival'] },
  sage: { name: 'Мудрець', skills: ['arcana', 'history'] },
  sailor: { name: 'Моряк', skills: ['athletics', 'perception'] },
  soldier: { name: 'Солдат', skills: ['athletics', 'intimidation'] },
  urchin: { name: 'Безпритульний', skills: ['sleight', 'stealth'] },
  custom: { name: 'Своя передісторія', skills: [], choose: 2 },
};

export const ALIGNMENTS = [
  'Законно-добрий', 'Нейтрально-добрий', 'Хаотично-добрий',
  'Законно-нейтральний', 'Нейтральний', 'Хаотично-нейтральний',
  'Законно-злий', 'Нейтрально-злий', 'Хаотично-злий',
];

export const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_TOTAL = 27;

const FULL_SLOTS = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

export const mod = (score) => Math.floor((Number(score) - 10) / 2);
export const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`);
export const profBonus = (level) => 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function levelForXp(xp) {
  let lvl = 1;
  for (let i = 0; i < XP_TABLE.length; i++) if (xp >= XP_TABLE[i]) lvl = i + 1;
  return lvl;
}

export function isAsiLevel(classId, level) {
  const c = CLASSES[classId];
  return [4, 8, 12, 16, 19].includes(level) || !!(c && c.extraAsi && c.extraAsi.includes(level));
}

export function expertiseAt(classId, level) {
  const c = CLASSES[classId];
  return (c && c.expertise && c.expertise[level]) || 0;
}

export function subclassSpec(classId, subclassId) {
  const cd = CLASS_DATA[classId];
  return (cd && subclassId && cd.subclasses[subclassId]) || null;
}
export function casterInfo(classId, subclassId) {
  const sc = subclassSpec(classId, subclassId);
  if (sc && sc.caster) return { type: sc.caster, ability: sc.spellAbility };
  const c = CLASSES[classId];
  if (c && c.caster !== 'none') return { type: c.caster, ability: c.spellAbility };
  return { type: 'none', ability: null };
}

// Масив кількості комірок по колам (індекс 0 = 1-ше коло)
export function spellSlots(classId, level, subclassId) {
  const t = casterInfo(classId, subclassId).type;
  level = clamp(level, 1, 20);
  if (t === 'full') return FULL_SLOTS[level].slice();
  if (t === 'half') return level < 2 ? [] : FULL_SLOTS[Math.ceil(level / 2)].slice();
  if (t === 'third') return level < 3 ? [] : FULL_SLOTS[Math.ceil(level / 3)].slice();
  if (t === 'pact') {
    const count = level === 1 ? 1 : level <= 10 ? 2 : level <= 16 ? 3 : 4;
    const slotLevel = Math.min(5, Math.ceil(level / 2));
    const arr = new Array(slotLevel).fill(0);
    arr[slotLevel - 1] = count;
    return arr;
  }
  return [];
}
export const isCaster = (sheet) => casterInfo(sheet.classId, sheet.subclassId).type !== 'none';
export const canCastAnySpell = (sheet) => isCaster(sheet) || ['high_elf', 'tiefling'].includes(sheet.raceId) || !!((RACE_DATA[sheet.raceId] || {}).spells || (RACE_DATA[sheet.raceId] || {}).cantrips);

export const hdAverage = (hd) => hd / 2 + 1;

// Типи подій, які записує майстер (бій, дослідження…): [назва, значок]
export const EVENT_TYPES = { combat: ['Бій', '⚔️'], explore: ['Дослідження', '🧭'], social: ['Розмова', '💬'], other: ['Інше', '✨'] };

// ---------- Ефекти: стани з Книги гравця 5e + поширені закляття й уміння ----------
// def — тривалість за замовчуванням ({ n, unit }); unit: round | min | hour | day | perm (до зняття) | lvl (рівні виснаження).
// mech — вплив на кидки: on — attack | check | save, abil — лише для цих характеристик, mode — adv | dis | fail (автоматичний провал) | note,
// min — з якого рівня (для виснаження)
export const EFFECT_UNITS = ['round', 'min', 'hour', 'day', 'perm'];
const R10 = { n: 10, unit: 'round' };
const PERM = { n: 0, unit: 'perm' };
const STR_DEX_FAIL = { on: 'save', abil: ['str', 'dex'], mode: 'fail' };
export const EFFECTS = {
  blinded: { g: 'cond', icon: '🙈', name: 'Осліплений', def: R10, mech: [{ on: 'attack', mode: 'dis' }],
    desc: 'Не бачить і автоматично провалює перевірки, що потребують зору. Кидки атаки по ньому — з перевагою, його кидки атаки — з перешкодою.' },
  charmed: { g: 'cond', icon: '💘', name: 'Зачарований', def: { n: 1, unit: 'hour' }, mech: [],
    desc: 'Не може атакувати того, хто його зачарував, і робити його ціллю шкідливих умінь чи магії. Той, хто зачарував, має перевагу на перевірки соціальної взаємодії з ним.' },
  deafened: { g: 'cond', icon: '🙉', name: 'Оглухлий', def: R10, mech: [],
    desc: 'Не чує і автоматично провалює перевірки, що потребують слуху.' },
  frightened: { g: 'cond', icon: '😱', name: 'Наляканий', def: R10, mech: [{ on: 'attack', mode: 'dis' }, { on: 'check', mode: 'dis' }],
    desc: 'Перешкода на перевірки характеристик і кидки атаки, поки джерело страху в полі зору. Не може добровільно наближатися до джерела страху.' },
  grappled: { g: 'cond', icon: '🤼', name: 'Схоплений', def: PERM, mech: [],
    desc: 'Швидкість стає 0 і не може збільшуватися. Стан закінчується, якщо той, хто схопив, стає недієздатним або ціль опиняється поза його досяжністю.' },
  incapacitated: { g: 'cond', icon: '😵', name: 'Недієздатний', def: PERM, mech: [],
    desc: 'Не може виконувати дії та реакції.' },
  invisible: { g: 'cond', icon: '👻', name: 'Невидимий', def: { n: 1, unit: 'hour' }, mech: [{ on: 'attack', mode: 'adv' }],
    desc: 'Його неможливо побачити без магії чи особливого чуття. Його кидки атаки — з перевагою, кидки атаки по ньому — з перешкодою.' },
  paralyzed: { g: 'cond', icon: '🧊', name: 'Паралізований', def: R10, mech: [STR_DEX_FAIL],
    desc: 'Недієздатний, не може рухатися й говорити. Автоматично провалює рятівні кидки Сили та Спритності. Атаки по ньому — з перевагою; влучання з відстані до 5 футів — критичне.' },
  petrified: { g: 'cond', icon: '🗿', name: 'Скам’янілий', def: PERM, mech: [STR_DEX_FAIL],
    desc: 'Перетворений на камінь разом із неживими предметами при собі. Недієздатний, не рухається, не говорить і не усвідомлює оточення. Атаки по ньому — з перевагою. Автоматично провалює рятівні кидки Сили та Спритності. Має опір до всієї шкоди та імунітет до отрути й хвороб.' },
  poisoned: { g: 'cond', icon: '🤢', name: 'Отруєний', def: { n: 1, unit: 'hour' }, mech: [{ on: 'attack', mode: 'dis' }, { on: 'check', mode: 'dis' }],
    desc: 'Перешкода на кидки атаки та перевірки характеристик.' },
  prone: { g: 'cond', icon: '🛌', name: 'Збитий з ніг', def: PERM, mech: [{ on: 'attack', mode: 'dis' }],
    desc: 'Може лише повзти, доки не встане (це коштує половину швидкості). Його кидки атаки — з перешкодою. Атаки по ньому з відстані до 5 футів — з перевагою, здалеку — з перешкодою.' },
  restrained: { g: 'cond', icon: '⛓️', name: 'Обплутаний', def: R10, mech: [{ on: 'attack', mode: 'dis' }, { on: 'save', abil: ['dex'], mode: 'dis' }],
    desc: 'Швидкість стає 0. Його кидки атаки — з перешкодою, кидки атаки по ньому — з перевагою. Перешкода на рятівні кидки Спритності.' },
  stunned: { g: 'cond', icon: '💫', name: 'Приголомшений', def: { n: 1, unit: 'round' }, mech: [STR_DEX_FAIL],
    desc: 'Недієздатний, не може рухатися, говорить уривками. Автоматично провалює рятівні кидки Сили та Спритності. Атаки по ньому — з перевагою.' },
  unconscious: { g: 'cond', icon: '💤', name: 'Непритомний', def: PERM, mech: [STR_DEX_FAIL],
    desc: 'Недієздатний, не рухається, не говорить і не усвідомлює оточення. Кидає все, що тримає, і падає. Автоматично провалює рятівні кидки Сили та Спритності. Атаки по ньому — з перевагою; влучання з відстані до 5 футів — критичне.' },
  exhaustion: { g: 'cond', icon: '🥱', name: 'Виснаження', def: { n: 1, unit: 'lvl' }, max: 6,
    mech: [{ on: 'check', mode: 'dis', min: 1 }, { on: 'attack', mode: 'dis', min: 3 }, { on: 'save', mode: 'dis', min: 3 }],
    desc: 'Рівні складаються. 1 — перешкода на перевірки характеристик; 2 — швидкість удвічі менша; 3 — перешкода на кидки атаки й рятівні кидки; 4 — максимум хітів удвічі менший; 5 — швидкість 0; 6 — смерть. Тривалий відпочинок знімає 1 рівень.' },
  bless: { g: 'spell', icon: '✨', name: 'Благословення', def: R10, mech: [{ on: 'attack', mode: 'note', note: '+1к4' }, { on: 'save', mode: 'note', note: '+1к4' }],
    desc: '+1к4 до кидків атаки та рятівних кидків. Концентрація, до 1 хвилини.' },
  bane: { g: 'spell', icon: '🕷️', name: 'Згуба', def: R10, mech: [{ on: 'attack', mode: 'note', note: '−1к4' }, { on: 'save', mode: 'note', note: '−1к4' }],
    desc: '−1к4 до кидків атаки та рятівних кидків. Концентрація, до 1 хвилини.' },
  haste: { g: 'spell', icon: '⚡', name: 'Прискорення', def: R10, mech: [{ on: 'save', abil: ['dex'], mode: 'adv' }],
    desc: '+2 до КЗ, перевага на рятівні кидки Спритності, швидкість подвоюється, додаткова дія щоходу (одна атака зброєю, ривок, відхід, засідка або використання предмета). Коли ефект закінчується — не може рухатися й діяти до кінця свого наступного ходу. Концентрація, до 1 хвилини.' },
  slow: { g: 'spell', icon: '🐌', name: 'Уповільнення', def: R10, mech: [{ on: 'save', abil: ['dex'], mode: 'note', note: '−2' }],
    desc: '−2 до КЗ і рятівних кидків Спритності, швидкість удвічі менша, без реакцій; за хід — лише дія або бонусна дія, не більше однієї атаки. Концентрація, до 1 хвилини.' },
  rage: { g: 'spell', icon: '😡', name: 'Лють', def: R10, mech: [{ on: 'check', abil: ['str'], mode: 'adv' }, { on: 'save', abil: ['str'], mode: 'adv' }],
    desc: 'Перевага на перевірки й рятівні кидки Сили, бонус до шкоди рукопашних атак Силою, опір дробильній, колючій і рубальній шкоді. Не може творити й підтримувати закляття. До 1 хвилини.' },
  concentration: { g: 'spell', icon: '🧘', name: 'Концентрація', def: PERM, mech: [],
    desc: 'Підтримує закляття. Отримавши шкоду, робить рятівний кидок Статури (СК 10 або половина шкоди, що більше); провал перериває закляття. Також переривається, якщо стає недієздатним.' },
  hunters_mark: { g: 'spell', icon: '🎯', name: 'Мітка мисливця', def: { n: 1, unit: 'hour' }, mech: [],
    desc: '+1к6 шкоди по позначеній цілі; перевага на перевірки Уважності та Виживання, щоб її знайти. Концентрація, до 1 години.' },
  hex: { g: 'spell', icon: '🧿', name: 'Порча', def: { n: 1, unit: 'hour' }, mech: [],
    desc: 'Заклинач завдає ураженому додатково 1к6 некротичної шкоди при влучанні. Уражений має перешкоду на перевірки однієї обраної характеристики. Концентрація, до 1 години.' },
  shield_of_faith: { g: 'spell', icon: '🛡️', name: 'Щит віри', def: { n: 10, unit: 'min' }, mech: [],
    desc: '+2 до КЗ. Концентрація, до 10 хвилин.' },
  faerie_fire: { g: 'spell', icon: '🧚', name: 'Вогонь фей', def: R10, mech: [],
    desc: 'Світиться: кидки атаки по ньому — з перевагою, не може бути невидимим. Концентрація, до 1 хвилини.' },
  bardic: { g: 'spell', icon: '🎵', name: 'Натхнення барда', def: { n: 10, unit: 'min' },
    mech: [{ on: 'attack', mode: 'note', note: '+кістка барда' }, { on: 'check', mode: 'note', note: '+кістка барда' }, { on: 'save', mode: 'note', note: '+кістка барда' }],
    desc: 'Може один раз додати кістку натхнення барда до перевірки характеристики, кидка атаки чи рятівного кидка. До 10 хвилин.' },
  guidance: { g: 'spell', icon: '🙏', name: 'Вказівка', def: R10, mech: [{ on: 'check', mode: 'note', note: '+1к4' }],
    desc: '+1к4 до однієї перевірки характеристики на вибір. Концентрація, до 1 хвилини.' },
  resistance: { g: 'spell', icon: '🔰', name: 'Опір', def: R10, mech: [{ on: 'save', mode: 'note', note: '+1к4' }],
    desc: '+1к4 до одного рятівного кидка на вибір. Концентрація, до 1 хвилини.' },
  heroism: { g: 'spell', icon: '🦸', name: 'Героїзм', def: R10, mech: [],
    desc: 'Імунітет до переляку; на початку кожного свого ходу отримує тимчасові хіти, що дорівнюють модифікатору заклинальної характеристики заклинача. Концентрація, до 1 хвилини.' },
  fly: { g: 'spell', icon: '🕊️', name: 'Політ', def: { n: 10, unit: 'min' }, mech: [],
    desc: 'Швидкість польоту 60 футів. Якщо ефект закінчується в повітрі — падає. Концентрація, до 10 хвилин.' },
};
export const EFFECT_GROUPS = [['cond', 'Стани'], ['spell', 'Закляття та вміння']];
// Скільки атак дає дія «Атака» (Додаткова атака: 2, у воїна — до 4)
export function attacksPerAction(sheet) {
  let n = 1;
  for (const f of sheet.features || []) {
    if (!/^Додаткова атака/.test(f.name || '')) continue;
    const m = /\((\d+) атак/.exec(f.name);
    n = Math.max(n, m ? Number(m[1]) : 2);
  }
  return n;
}
// Вплив активних ефектів на кидок (purpose — як у вкладці кидків: attack:…, save:dex, skill:stealth, init…)
export function effectRoll(effects, purpose) {
  const [kind, key] = String(purpose || '').split(':');
  const on = kind === 'attack' || kind === 'spellattack' ? 'attack' : kind === 'save' ? 'save' : ['ability', 'skill', 'init'].includes(kind) ? 'check' : null;
  const res = { mode: '', cancel: false, hints: [] };
  if (!on) return res;
  const abil = kind === 'init' ? 'dex' : kind === 'skill' ? (SKILLS[key] || [])[1] : key;
  let adv = false;
  let dis = false;
  for (const e of effects || []) {
    const def = e.key ? EFFECTS[e.key] : null;
    if (!def) continue;
    for (const m of def.mech || []) {
      if (m.on !== on || (m.abil && !m.abil.includes(abil)) || (m.min && (e.n || 0) < m.min)) continue;
      if (m.mode === 'adv') adv = true;
      if (m.mode === 'dis') dis = true;
      res.hints.push({ icon: def.icon, name: def.name, mode: m.mode, note: m.note || '' });
    }
  }
  res.mode = adv && dis ? '' : adv ? 'adv' : dis ? 'dis' : '';
  res.cancel = adv && dis;
  return res;
}

export function rollDie(sides) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % sides) + 1;
}

export function roll4d6DropLowest() {
  const r = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)].sort((a, b) => b - a);
  return r[0] + r[1] + r[2];
}

export const RARITIES = {
  common: { name: 'Звичайний', color: '#9e9e9e' },
  uncommon: { name: 'Незвичайний', color: '#2fbf4a' },
  rare: { name: 'Рідкісний', color: '#3d8bff' },
  very_rare: { name: 'Епічний', color: '#a64dff' },
  legendary: { name: 'Легендарний', color: '#ff3b3b' },
};
export const RARITY_IDS = Object.keys(RARITIES);

export const ITEM_TYPES = {
  weapon: 'Зброя', armor: 'Обладунок', shield: 'Щит', ammo: 'Боєприпаси', gear: 'Спорядження',
  tool: 'Інструменти', potion: 'Зілля', ring: 'Каблучка', rod: 'Жезл', staff: 'Посох',
  wand: 'Паличка', scroll: 'Сувій', wondrous: 'Чудесний предмет', food: 'Їжа', treasure: 'Скарб', other: 'Інше',
};

export const COINS = ['pp', 'gp', 'ep', 'sp', 'cp'];
export const COIN_NAMES = { pp: 'ПМ', gp: 'ЗМ', ep: 'ЕМ', sp: 'СМ', cp: 'ММ' };
export const COIN_FULL = { pp: 'платинові', gp: 'золоті', ep: 'електрумові', sp: 'срібні', cp: 'мідні' };

export const DAMAGE_TYPES = ['дробильна', 'колюча', 'рубальна', 'вогнем', 'холодом', 'блискавкою', 'громом',
  'кислотою', 'отрутою', 'некротична', 'промениста', 'психічна', 'силова'];

export const SPELL_SCHOOLS = ['Огородження', 'Виклик', 'Віщування', 'Зачарування', 'Втілення', 'Ілюзія', 'Некромантія', 'Перетворення'];

export const TEXT_FIELDS = {
  features: 'Вміння та риси',
  proficiencies: 'Нотатки до володінь',
  personality: 'Риси характеру',
  ideals: 'Ідеали',
  bonds: 'Прихильності',
  flaws: 'Вади',
  appearance: 'Зовнішність',
  backstory: 'Передісторія персонажа',
  allies: 'Союзники та організації',
  treasure: 'Скарби та нотатки',
  age: 'Вік', height: 'Зріст', weight: 'Вага', eyes: 'Очі', skin: 'Шкіра', hair: 'Волосся',
};
export const TEXT_FIELD_IDS = Object.keys(TEXT_FIELDS);

// ---- Похідні значення листа персонажа ----

export function skillValue(sheet, skillId) {
  const [, ab] = SKILLS[skillId];
  const p = (sheet.skills && sheet.skills[skillId]) || 0;
  return mod(sheet.abilities[ab]) + p * sheetProf(sheet);
}

export function saveValue(sheet, ab) {
  const prof = (sheet.saves || []).includes(ab);
  return mod(sheet.abilities[ab]) + (prof ? sheetProf(sheet) : 0);
}

export function sheetProf(sheet) {
  return sheet.profOverride != null && sheet.profOverride !== '' ? Number(sheet.profOverride) : profBonus(sheet.level);
}

export function sheetSlots(sheet) {
  if (Array.isArray(sheet.spell && sheet.spell.slotsOverride)) return sheet.spell.slotsOverride.map(Number);
  return spellSlots(sheet.classId, sheet.level, sheet.subclassId);
}

export function spellAbility(sheet) {
  return (sheet.spell && sheet.spell.ability) || casterInfo(sheet.classId, sheet.subclassId).ability || 'int';
}
const hasStyle = (sheet, id) => [...((sheet.choices || {}).fightingStyle || []), ...((sheet.choices || {}).fightingStyle2 || [])].includes(id);

// items: [{data, equipped}]
export function computeAC(sheet, items) {
  if (sheet.acOverride != null && sheet.acOverride !== '') return Number(sheet.acOverride);
  const dex = mod(sheet.abilities.dex);
  let base = null;
  let shield = 0;
  let bonus = Number(sheet.acBonus || 0);
  let armored = false;
  for (const it of items || []) {
    if (!it.equipped) continue;
    const d = it.data || {};
    if (d.type === 'armor' && d.ac) {
      const cap = d.dexMax == null || d.dexMax === '' ? 99 : Number(d.dexMax);
      const v = Number(d.ac) + Math.min(dex, cap) + Number(d.bonus || 0);
      base = base == null ? v : Math.max(base, v);
      armored = true;
    } else if (d.type === 'shield') {
      shield = Math.max(shield, Number(d.ac || 2) + Number(d.bonus || 0));
    } else if (d.acBonus) {
      bonus += Number(d.acBonus);
    }
  }
  if (base == null) {
    const c = CLASSES[sheet.classId];
    base = 10 + dex;
    if (c && c.unarmored === 'con') base += mod(sheet.abilities.con);
    if (c && c.unarmored === 'wis' && !shield) base += mod(sheet.abilities.wis);
    const sc = subclassSpec(sheet.classId, sheet.subclassId);
    if (sc && sc.unarmoredBase) base = Math.max(base, sc.unarmoredBase + dex);
    // природна броня раси
    const rd = raceData(sheet);
    if (rd && rd.ac) base = Math.max(base, rd.ac.flat != null ? rd.ac.flat : rd.ac.base + mod(sheet.abilities[rd.ac.ab]));
  }
  const rdx = raceData(sheet);
  if (rdx && rdx.acBonus) bonus += rdx.acBonus;
  if (((sheet.choices || {}).simic5 || []).includes('carapace') && !(items || []).some((it) => it.equipped && it.data && it.data.type === 'armor' && /heavy|важк/i.test(String(it.data.cat || it.data.group || '')))) bonus += 1;
  if (armored && hasStyle(sheet, 'defense')) bonus += 1;
  return base + shield + bonus;
}

export function weaponAttack(sheet, d) {
  const props = (d.props || '').toLowerCase();
  const str = mod(sheet.abilities.str);
  const dex = mod(sheet.abilities.dex);
  let abMod = str;
  if (d.ranged) abMod = dex;
  if (props.includes('фехтув') || (sheet.classId === 'monk' && weaponTags(d).monk)) abMod = Math.max(str, dex);
  if (d.ability && sheet.abilities[d.ability] != null) abMod = mod(sheet.abilities[d.ability]);
  const magic = Number(d.bonus || 0);
  const noProf = weaponProficient(sheet, d) === false;
  const hit = abMod + (noProf ? 0 : sheetProf(sheet)) + magic + (d.ranged && hasStyle(sheet, 'archery') ? 2 : 0);
  const dmgMod = abMod + magic;
  const dmg = d.damage ? `${d.damage}${dmgMod ? (dmgMod > 0 ? '+' + dmgMod : dmgMod) : ''} ${d.dmgType || ''}`.trim() : '—';
  return { hit, dmg, noProf, dmgMod };
}

export function passivePerception(sheet) {
  return 10 + skillValue(sheet, 'perception') + Number(sheet.passiveBonus || 0);
}

export const inspCount = (s) => (typeof s.inspiration === 'number' ? s.inspiration : s.inspiration ? 1 : 0);

export function emptyMoney() { return { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }; }

export function newSheetTemplate() {
  return {
    name: '', raceId: '', classId: '', backgroundId: '', subclass: '', alignment: '',
    level: 1, xp: 0, targetLevel: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saves: [], skills: {},
    hp: { max: 1, cur: 1, temp: 0 }, hitDiceUsed: 0, deathSaves: { s: 0, f: 0 }, inspiration: 0,
    speed: 30, acBonus: 0, acOverride: null, initBonus: 0, profOverride: null,
    text: {}, spell: { ability: null, slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0], slotsOverride: null, spells: [] },
    money: emptyMoney(),
    subclassId: '', features: [], choices: {}, feats: [], resUsed: {}, passiveBonus: 0, shortRest: null,
  };
}

// Побудова листа 1 рівня з даних майстра створення (валідація виконується на сервері)
// input: {name, raceId, classId, backgroundId, alignment, base:{..6}, raceChoice:[ab,ab], skills:[...], raceSkills:[...], bgSkills:[...], expertise:[...], text:{}}
export function buildCharacter(input, opts = {}) {
  const errors = [];
  const race = RACES[input.raceId];
  const cls = CLASSES[input.classId];
  const bg = BACKGROUNDS[input.backgroundId];
  if (!race) errors.push('Оберіть расу');
  if (!cls) errors.push('Оберіть клас');
  if (!bg) errors.push('Оберіть передісторію');
  const name = String(input.name || '').trim().slice(0, 60);
  if (!name) errors.push('Вкажіть ім’я персонажа');
  if (errors.length) return { errors };

  const s = newSheetTemplate();
  s.name = name;
  s.raceId = input.raceId; s.classId = input.classId; s.backgroundId = input.backgroundId;
  s.alignment = ALIGNMENTS.includes(input.alignment) ? input.alignment : '';
  s.speed = race.speed;

  // Характеристики
  const abil = {};
  for (const a of ABILITIES) abil[a] = Number(input.base && input.base[a]);
  for (const a of ABILITIES) abil[a] += race.bonus[a] || 0;
  if (race.choose) {
    const ch = Array.isArray(input.raceChoice) ? input.raceChoice : [];
    const uniq = [...new Set(ch)].filter((a) => ABILITIES.includes(a) && !race.choose.exclude.includes(a));
    if (uniq.length !== race.choose.count) errors.push(`Оберіть ${race.choose.count} різні характеристики для расового бонусу`);
    for (const a of uniq) abil[a] += race.choose.amount;
  }
  if (race.flex) {
    // MPMM: +2 до однієї й +1 до іншої або +1 до трьох різних
    const ch = [...new Set(Array.isArray(input.raceChoice) ? input.raceChoice : [])].filter((a) => ABILITIES.includes(a));
    if (input.raceMode === '111') {
      if (ch.length !== 3) errors.push('Оберіть три різні характеристики для бонусу +1');
      else for (const a of ch) abil[a] += 1;
    } else if (ch.length !== 2) errors.push('Оберіть характеристики для бонусів раси +2 і +1');
    else { abil[ch[0]] += 2; abil[ch[1]] += 1; }
  }
  s.abilities = abil;
  s.saves = cls.saves.slice();

  // Навички
  const skills = {};
  const bgSkills = bg.choose ? (input.bgSkills || []) : bg.skills;
  if (bg.choose) {
    const u = [...new Set(bgSkills)].filter((k) => SKILLS[k]);
    if (u.length !== bg.choose) errors.push(`Оберіть ${bg.choose} навички передісторії`);
  }
  for (const k of bgSkills) if (SKILLS[k]) skills[k] = 1;
  for (const k of race.skills || []) skills[k] = 1;
  if (race.skillChoice) {
    const u = [...new Set(input.raceSkills || [])].filter((k) => SKILLS[k] && !skills[k]);
    if (u.length !== race.skillChoice) errors.push(`Оберіть ${race.skillChoice} додаткові навички раси`);
    for (const k of u) skills[k] = 1;
  }
  const allowed = cls.skills === 'any' ? SKILL_IDS : cls.skills;
  const chosen = [...new Set(input.skills || [])].filter((k) => allowed.includes(k) && !skills[k]);
  if (chosen.length !== cls.skillCount) errors.push(`Оберіть ${cls.skillCount} навички класу (без повторів)`);
  for (const k of chosen) skills[k] = 1;
  const exp = expertiseAt(input.classId, 1);
  if (exp) {
    const e = [...new Set(input.expertise || [])].filter((k) => skills[k] === 1);
    if (e.length !== exp) errors.push(`Оберіть ${exp} навички для експертизи`);
    for (const k of e) skills[k] = 2;
  }
  s.skills = skills;

  // Вміння 1 рівня, підклас і вибори
  s.features = [];
  for (const [n, d] of RACE_TRAITS[input.raceId] || []) s.features.push({ lvl: 1, name: n, desc: d, src: 'race' });
  errors.push(...gainLevelFeatures(s, 1, { subclassId: input.subclassId, choices: input.choices }));

  // Початковий рівень вище 1: проходимо розвиток 2…N за правилами
  const N = Math.max(1, Math.min(20, Math.floor(Number(input.level) || 1)));
  if (N > 1 && !errors.length) errors.push(...developTo(s, N, input, opts.snaps));

  // Хіти: 1 рівень — максимум кості, далі — середнє (з підсумковою СТА)
  const per = mod(s.abilities.con) + hpPerLevelBonus(s);
  const hp = Math.max(1, cls.hd + per) + (N - 1) * Math.max(1, hdAverage(cls.hd) + per);
  s.hp = { max: hp, cur: hp, temp: 0 };
  s.level = N; s.targetLevel = N; s.xp = XP_TABLE[N - 1];
  s.features.sort((a, b) => a.lvl - b.lvl);
  // Володіння й мови (з виборами раси, класу, передісторії, підкласу)
  // opts.partial — проміжна перевірка в майстрі створення: без володінь і заклять
  const pr = buildProf(s, input.profPicks || {});
  s.prof = pr.prof;
  if (!opts.partial) errors.push(...pr.errors);

  // Закляття (можна обрати й пізніше — вільні місця лишаються)
  s.spell.spells = [];
  if (Array.isArray(input.spells) && input.spells.length && !opts.partial) {
    const r = checkSpells(s, [], input.spells, 'create');
    errors.push(...r.errors);
    s.spell.spells = r.list;
  }
  s.spell.swaps = 0;
  s.spell.prepOpen = true;
  s.spell.ability = null;
  s.text = {};
  for (const k of TEXT_FIELD_IDS) if (input.text && input.text[k]) s.text[k] = String(input.text[k]).slice(0, 4000);
  return { errors, sheet: s };
}

// Розвиток персонажа від 2 до N рівня при створенні.
// input.asi[L] = {mode:'asi', asi:{str:1,...}} | {mode:'feat', feat:{id, ability, skills}}
// input.expertiseAt[L] = [skill], input.choicesUp = {specId:[...]} — накопичені вибори класу/підкласу до N.
// snaps (необов'язково) — сюди кладуться копії листа перед кроками ПХ/експертизи кожного рівня (для інтерфейсу).
function developTo(s, N, input, snaps) {
  const errors = [];
  for (let L = 2; L <= N; L++) errors.push(...gainLevelFeatures(s, L, { subclassId: input.subclassId, skipChoices: true }));
  s.level = N;
  errors.push(...applyChoicesAt(s, N, input.choicesUp || {}, true));
  const asiIn = input.asi || {};
  const expIn = input.expertiseAt || {};
  for (let L = 2; L <= N; L++) {
    s.level = L;
    if (snaps && (isAsiLevel(s.classId, L) || expertiseAt(s.classId, L))) snaps[L] = JSON.parse(JSON.stringify(s));
    if (isAsiLevel(s.classId, L)) {
      const a = asiIn[L] || {};
      if (a.mode === 'feat') {
        errors.push(...applyFeat(s, a.feat || {}, L, 0).map((e) => `Рівень ${L}: ${e}`));
      } else {
        let sum = 0;
        const inc = {};
        for (const k of ABILITIES) { const v = Math.floor(Number(a.asi && a.asi[k]) || 0); if (v > 0) { inc[k] = Math.min(2, v); sum += inc[k]; } }
        if (sum !== 2) errors.push(`Рівень ${L}: розподіли 2 очки характеристик або обери рису`);
        else if (Object.keys(inc).some((k) => s.abilities[k] + inc[k] > 20)) errors.push(`Рівень ${L}: характеристика не може перевищувати 20`);
        else for (const k of Object.keys(inc)) s.abilities[k] += inc[k];
      }
    }
    const expN = expertiseAt(s.classId, L);
    if (expN) {
      const e = [...new Set(Array.isArray(expIn[L]) ? expIn[L] : [])].filter((k) => s.skills[k] === 1);
      if (e.length !== expN) errors.push(`Рівень ${L}: обери ${expN} навички для експертизи`);
      for (const k of e) s.skills[k] = 2;
    }
    levelEffects(s, L);
  }
  s.level = N;
  return [...new Set(errors)];
}

export function validateBase(method, base, roll) {
  const vals = ABILITIES.map((a) => Number(base && base[a]));
  if (vals.some((v) => !Number.isInteger(v))) return 'Невірні значення характеристик';
  const sorted = (arr) => arr.slice().sort((a, b) => a - b).join(',');
  if (method === 'standard') {
    if (sorted(vals) !== sorted(STANDARD_ARRAY)) return 'Значення мають бути зі стандартного набору 15, 14, 13, 12, 10, 8';
  } else if (method === 'pointbuy') {
    let cost = 0;
    for (const v of vals) {
      if (POINT_BUY_COST[v] == null) return 'При купівлі очками значення 8–15';
      cost += POINT_BUY_COST[v];
    }
    if (cost > POINT_BUY_TOTAL) return `Витрачено ${cost} очок з ${POINT_BUY_TOTAL}`;
  } else if (method === 'roll') {
    if (!Array.isArray(roll) || roll.length !== 6) return 'Спочатку кинь кубики';
    if (sorted(vals) !== sorted(roll)) return 'Значення мають відповідати твоєму кидку';
  } else return 'Оберіть спосіб визначення характеристик';
  return null;
}

// ================= Вміння, підкласи, вибори =================
export function totalAt(spec, level) {
  let t = 0;
  for (const [l, v] of Object.entries(spec.total)) if (level >= Number(l)) t = Math.max(t, v);
  return t;
}
export function subclassNeeded(sheet, level) {
  const cd = CLASS_DATA[sheet.classId];
  return !!cd && Object.keys(cd.subclasses).length > 0 && level >= cd.subclassLevel && !subclassSpec(sheet.classId, sheet.subclassId);
}
export function pendingChoices(sheet, level) {
  const cd = CLASS_DATA[sheet.classId] || {};
  const sc = subclassSpec(sheet.classId, sheet.subclassId) || {};
  const specs = [...(RACE_CHOICES[sheet.raceId] || []), ...(cd.choices || []), ...(sc.choices || [])];
  const ch = sheet.choices || {};
  return specs.map((sp) => ({ ...sp, need: totalAt(sp, level) - (ch[sp.id] || []).length }))
    .filter((sp) => sp.need > 0)
    .sort((a, b) => (a.id === 'pactBoon' ? -1 : b.id === 'pactBoon' ? 1 : 0));
}
export function choiceOptions(spec, sheet, level) {
  const ch = sheet.choices || {};
  if (spec.kind === 'skill') return (spec.from || SKILL_IDS).map((k) => ({ id: k, name: SKILLS[k][0], desc: '', disabled: !!sheet.skills[k], reason: sheet.skills[k] ? 'вже є' : '' }));
  if (spec.kind === 'feat') {
    // риса на 1 рівні (людина-варіант, своє походження); пів-риси з вибором характеристики — окремими варіантами
    return featOptions(sheet).filter((ft) => ft.id !== 'skilled').flatMap((ft) => (ft.asi && ft.asi.length > 1
      ? ft.asi.map((a) => ({ id: `${ft.id}:${a}`, name: `${ft.name} (${ABILITY_SHORT[a]} +1)`, desc: ft.desc, disabled: ft.disabled || sheet.abilities[a] >= 20, reason: ft.reason || (sheet.abilities[a] >= 20 ? 'характеристика вже 20' : '') }))
      : [{ id: ft.id, name: ft.name, desc: ft.desc, disabled: ft.disabled, reason: ft.reason }]));
  }
  if (spec.kind === 'expert') return spec.from.map((k) => ({ id: k, name: SKILLS[k][0], desc: 'Володіння з подвоєним бонусом майстерності.', disabled: sheet.skills[k] === 2, reason: sheet.skills[k] === 2 ? 'вже є' : '' }));
  const taken = new Set([...(ch[spec.id] || []), ...(spec.exclude ? ch[spec.exclude] || [] : [])]);
  return spec.options.map((op) => {
    let reason = '';
    if (taken.has(op.id)) reason = 'вже обрано';
    else if (op.lvl && level < op.lvl) reason = `з ${op.lvl} рівня`;
    else if (op.pact && !(ch.pactBoon || []).includes(op.pact)) reason = `потрібен ${PACT_BOONS.find((x) => x.id === op.pact).name.toLowerCase()}`;
    return { ...op, disabled: !!reason, reason };
  });
}
export const classFeaturesAt = (classId, L) => ((CLASS_DATA[classId] || {}).features || {})[L] || [];
export const subclassFeaturesAt = (classId, subclassId, L) => ((subclassSpec(classId, subclassId) || {}).features || {})[L] || [];
const pushF = (sheet, list, lvl, src) => { for (const [n, d] of list) sheet.features.push({ lvl, name: n, desc: d || '', src }); };

// Нові вміння й вибори при досягненні рівня newLevel (для створення — 1). Повертає список помилок.
export function gainLevelFeatures(sheet, newLevel, input = {}) {
  const errors = [];
  const cd = CLASS_DATA[sheet.classId];
  if (!Array.isArray(sheet.features)) {
    // старий персонаж без структурованих вмінь — відновлюємо пропущене
    sheet.features = [];
    for (const [n, d] of RACE_TRAITS[sheet.raceId] || []) sheet.features.push({ lvl: 1, name: n, desc: d, src: 'race' });
    for (let L = 1; L < newLevel; L++) pushF(sheet, classFeaturesAt(sheet.classId, L), L, 'class');
  }
  sheet.choices = sheet.choices || {};
  if (cd && subclassNeeded(sheet, newLevel)) {
    const sc = cd.subclasses[input.subclassId];
    if (!sc) errors.push(`Обери: ${cd.subclassLabel.toLowerCase()}`);
    else {
      sheet.subclassId = input.subclassId;
      sheet.subclass = sc.name;
      grantProf(sheet, `${sheet.classId}.${sheet.subclassId}`, SUBCLASS_PROF);
      sheet.features.push({ lvl: newLevel, name: `${cd.subclassLabel}: ${sc.name}`, desc: '', src: 'subclass' });
      for (let L = cd.subclassLevel; L < newLevel; L++) pushF(sheet, subclassFeaturesAt(sheet.classId, sheet.subclassId, L), L, 'subclass');
    }
  }
  pushF(sheet, classFeaturesAt(sheet.classId, newLevel), newLevel, 'class');
  if (sheet.subclassId) pushF(sheet, subclassFeaturesAt(sheet.classId, sheet.subclassId, newLevel), newLevel, 'subclass');
  if (errors.length || input.skipChoices) return errors;
  return applyChoicesAt(sheet, newLevel, input.choices || {});
}

// Перший рівень, на якому з'являється n-й (з нуля) вибір специфікації
function pickLevel(spec, n) {
  const lv = Object.keys(spec.total).map(Number).sort((a, b) => a - b);
  for (const l of lv) if (spec.total[l] > n) return l;
  return lv[lv.length - 1] || 1;
}
// Застосувати всі невиконані вибори на рівні level. earliest — позначати вибір рівнем, де він з'явився.
export function applyChoicesAt(sheet, level, picks = {}, earliest = false) {
  const errors = [];
  sheet.choices = sheet.choices || {};
  for (const spec of pendingChoices(sheet, level)) {
    const raw = Array.isArray(picks[spec.id]) ? picks[spec.id] : picks[spec.id] ? [picks[spec.id]] : [];
    const sel = [...new Set(raw.map(String))];
    if (sel.length !== spec.need) { errors.push(`${spec.name}: обери ${spec.need}`); continue; }
    const opts = choiceOptions(spec, sheet, level);
    const bad = sel.find((id) => { const op = opts.find((x) => x.id === id); return !op || op.disabled; });
    if (bad) { errors.push(`${spec.name}: недоступний варіант`); continue; }
    const before = (sheet.choices[spec.id] || []).length;
    sheet.choices[spec.id] = [...(sheet.choices[spec.id] || []), ...sel];
    sel.forEach((id, i) => {
      const op = opts.find((x) => x.id === id);
      if (spec.kind === 'feat') {
        const [fid, ab] = id.split(':');
        errors.push(...applyFeat(sheet, { id: fid, ability: ab }, earliest ? pickLevel(spec, before + i) : level));
        return;
      }
      if (op.speed) sheet.speed = (Number(sheet.speed) || 30) + op.speed;
      if (spec.kind === 'skill') sheet.skills[id] = Math.max(1, sheet.skills[id] || 0);
      if (spec.kind === 'expert') sheet.skills[id] = 2;
      for (const k of op.skills || []) sheet.skills[k] = Math.max(1, sheet.skills[k] || 0);
      sheet.features.push({ lvl: earliest ? pickLevel(spec, before + i) : level, name: `${spec.name}: ${op.name}`, desc: op.desc || '', src: spec.src || 'choice' });
    });
  }
  return errors;
}

// Особливі ефекти рівня класу (застосовуються автоматично)
export function levelEffects(sheet, L) {
  const out = [];
  const c = sheet.classId;
  if ((c === 'barbarian' && L === 5) || (c === 'monk' && L === 2)) { sheet.speed += 10; out.push('швидкість +10 фт'); }
  if (c === 'monk' && [6, 10, 14, 18].includes(L)) { sheet.speed += 5; out.push('швидкість +5 фт'); }
  if (c === 'rogue' && L === 15 && !sheet.saves.includes('wis')) { sheet.saves.push('wis'); out.push('рятівні МДР'); }
  if (c === 'monk' && L === 14) { sheet.saves = ABILITIES.slice(); out.push('усі рятівні кидки'); }
  if (c === 'barbarian' && L === 20) {
    sheet.abilities.str = Math.min(24, sheet.abilities.str + 4);
    sheet.abilities.con = Math.min(24, sheet.abilities.con + 4);
    out.push('СИЛ і СТА +4');
  }
  return out;
}

export function hpPerLevelBonus(sheet) {
  return ((RACES[sheet.raceId] || {}).hpPerLevel || 0) + ((subclassSpec(sheet.classId, sheet.subclassId) || {}).hpPerLevel || 0)
    + ((sheet.feats || []).includes('tough') ? 2 : 0);
}

// ================= Риси =================
export function featOptions(sheet) {
  return FEATS.map((ft) => {
    let reason = '';
    if ((sheet.feats || []).includes(ft.id)) reason = 'вже є';
    else if (ft.req && Object.entries(ft.req).some(([a, v]) => sheet.abilities[a] < v)) reason = `потрібно ${Object.entries(ft.req).map(([a, v]) => `${ABILITY_SHORT[a]} ${v}`).join(', ')}`;
    else if (ft.reqAny && !Object.entries(ft.reqAny).some(([a, v]) => sheet.abilities[a] >= v)) reason = `потрібно ${Object.entries(ft.reqAny).map(([a, v]) => `${ABILITY_SHORT[a]} ${v}`).join(' або ')}`;
    else if (ft.spell && !canCastAnySpell(sheet)) reason = 'потрібна здатність творити закляття';
    else if (ft.asi && ft.asi.every((a) => sheet.abilities[a] >= 20)) reason = 'характеристики вже 20';
    return { ...ft, disabled: !!reason, reason };
  });
}
// input: {id, ability, skills:[]}
export function applyFeat(sheet, input, level, hpLevels = level) {
  const ft = featOptions(sheet).find((x) => x.id === (input && input.id));
  if (!ft) return ['Обери рису зі списку'];
  if (ft.disabled) return [`Риса «${ft.name}» недоступна: ${ft.reason}`];
  const extra = [];
  let ab = null;
  if (ft.asi) {
    ab = ft.asi.length === 1 ? ft.asi[0] : input.ability;
    if (!ft.asi.includes(ab)) return [`«${ft.name}»: обери характеристику`];
    if (sheet.abilities[ab] >= 20) return [`${ABILITY_NAMES[ab]} вже 20`];
    sheet.abilities[ab] += 1;
    extra.push(`${ABILITY_SHORT[ab]} +1`);
  }
  if (ft.effect === 'alert') sheet.initBonus = Number(sheet.initBonus || 0) + 5;
  if (ft.effect === 'mobile') sheet.speed += 10;
  if (ft.effect === 'observant') sheet.passiveBonus = Number(sheet.passiveBonus || 0) + 5;
  if (ft.effect === 'resilient' && !sheet.saves.includes(ab)) sheet.saves.push(ab);
  if (ft.effect === 'tough') { sheet.hp.max += 2 * hpLevels; sheet.hp.cur += 2 * hpLevels; extra.push('+2 ХП за кожен рівень'); }
  if (ft.effect === 'skilled') {
    const sk = [...new Set(input.skills || [])].filter((k) => SKILLS[k] && !sheet.skills[k]);
    if (sk.length !== 3) return ['«Вмілий»: обери 3 нові навички'];
    for (const k of sk) sheet.skills[k] = 1;
    extra.push(sk.map((k) => SKILLS[k][0]).join(', '));
  }
  sheet.feats = [...(sheet.feats || []), ft.id];
  grantProf(sheet, ft.id, FEAT_PROF);
  sheet.features = sheet.features || [];
  sheet.features.push({ lvl: level, name: `Риса: ${ft.name}`, desc: ft.desc + (extra.length ? ` (${extra.join('; ')})` : ''), src: 'feat' });
  return [];
}

// ================= Ресурси й відпочинок =================
export function sheetResources(sheet) {
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, mod(sheet.abilities[a])]));
  const used = sheet.resUsed || {};
  return [...resourceDefs(sheet.classId, sheet.subclassId, sheet.raceId, sheet.level, mods), ...raceResources(sheet, mods)].map((r) => ({ ...r, used: Math.min(r.max, Number(used[r.id] || 0)) }));
}
// ресурси раси (використання за відпочинок); max: число, 'prof' — бонус майстерності, ключ характеристики — її модифікатор (мін. 1)
export function raceResDefs(sheet) {
  const d = raceData(sheet);
  if (!d) return [];
  const out = (d.res || []).filter((r) => !r.lvl || (Number(sheet.level) || 1) >= r.lvl);
  if (d.breath) out.unshift({ id: 'breath', n: 'Подих', max: 1, rest: 'short', cost: ['action'], note: 'Подих за родоводом' });
  return out;
}
function raceResources(sheet, mods) {
  return raceResDefs(sheet).map((r) => ({ id: r.id, name: r.n, recharge: r.rest, pool: false,
    max: r.max === 'prof' ? sheetProf(sheet) : typeof r.max === 'string' ? Math.max(1, mods[r.max] || 0) : r.max }));
}
// kind: 'short' | 'long'; nowSec — поточний час у секундах
export function applyRest(sheet, kind, nowSec) {
  const out = [];
  sheet.resUsed = sheet.resUsed || {};
  const res = sheetResources(sheet);
  if (kind === 'long') {
    sheet.hp.cur = sheet.hp.max;
    sheet.hp.temp = 0;
    const regain = Math.max(1, Math.floor(sheet.level / 2));
    sheet.hitDiceUsed = Math.max(0, (sheet.hitDiceUsed || 0) - regain);
    sheet.deathSaves = { s: 0, f: 0 };
    sheet.spell.slotsUsed = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    sheet.resUsed = {};
    sheet.shortRest = null;
    out.push('повні ХП', `відновлено ${regain} кост. хітів`, 'комірки заклять і ресурси відновлено');
    if (isPreparedCaster(sheet)) { sheet.spell.prepOpen = true; out.push('можна змінити підготовлені закляття'); }
  } else {
    for (const r of res) if (r.recharge === 'short' && sheet.resUsed[r.id]) { sheet.resUsed[r.id] = 0; out.push(r.name); }
    if (casterInfo(sheet.classId, sheet.subclassId).type === 'pact') { sheet.spell.slotsUsed = [0, 0, 0, 0, 0, 0, 0, 0, 0]; out.push('комірки договору'); }
    sheet.shortRest = { until: nowSec + 2 * 3600 };
  }
  return out;
}
export const shortRestActive = (sheet, nowSec) => !!(sheet.shortRest && sheet.shortRest.until > nowSec);

// ================= Предмети =================
export function isConsumable(d) {
  if (!d) return false;
  if (d.consumable === true) return true;
  if (d.consumable === false) return false;
  return ['potion', 'scroll', 'ammo', 'food'].includes(d.type);
}
const CLASS_WORDS = { бард: 'bard', жрець: 'cleric', друїд: 'druid', паладин: 'paladin', чародій: 'sorcerer', чаклун: 'warlock', маг: 'wizard', воїн: 'fighter', монах: 'monk', слідопит: 'ranger', пройдисвіт: 'rogue', варвар: 'barbarian' };
export function attuneProblem(sheet, attune) {
  const m = String(attune || '').toLowerCase().match(/\(([^)]*)\)/);
  if (!m) return null;
  const words = m[1].split(/,|;| або | чи /).map((x) => x.trim()).filter(Boolean);
  let known = false;
  for (const w of words) {
    if (CLASS_WORDS[w]) { known = true; if (sheet.classId === CLASS_WORDS[w]) return null; }
    else if (w.startsWith('заклинач')) { known = true; if (canCastAnySpell(sheet)) return null; }
    else if (w.startsWith('дварф')) { known = true; if (sheet.raceId === 'hill_dwarf') return null; }
  }
  return known ? `Налаштуватися на цей предмет може лише: ${m[1]}` : null;
}

// ================= Закляття: що й скільки можна обрати =================
const CANTRIPS_KNOWN = { bard: { 1: 2, 4: 3, 10: 4 }, cleric: { 1: 3, 4: 4, 10: 5 }, druid: { 1: 2, 4: 3, 10: 4 }, sorcerer: { 1: 4, 4: 5, 10: 6 },
  warlock: { 1: 2, 4: 3, 10: 4 }, wizard: { 1: 3, 4: 4, 10: 5 }, eldritch_knight: { 3: 2, 10: 3 }, arcane_trickster: { 3: 2, 10: 3 } };
const SPELLS_KNOWN = {
  bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
  eldritch_knight: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
  arcane_trickster: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
};
const THIRD_SCHOOLS = { eldritch_knight: ['Огородження', 'Втілення'], arcane_trickster: ['Зачарування', 'Ілюзія'] };
const ANY_LIST = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'];
const atLv = (tbl, L) => { let v = 0; for (const [l, n] of Object.entries(tbl || {})) if (L >= Number(l)) v = n; return v; };
// Класи, що міняють одне відоме закляття при підвищенні рівня
export const SWAP_CASTERS = ['bard', 'sorcerer', 'warlock', 'ranger'];
export function spellCasterKey(sheet) {
  if (sheet.classId === 'fighter' && sheet.subclassId === 'eldritch_knight') return 'eldritch_knight';
  if (sheet.classId === 'rogue' && sheet.subclassId === 'arcane_trickster') return 'arcane_trickster';
  return sheet.classId;
}
export const canSwapSpell = (sheet) => SWAP_CASTERS.includes(spellCasterKey(sheet)) || !!THIRD_SCHOOLS[spellCasterKey(sheet)];
export const isPreparedCaster = (sheet) => ['cleric', 'druid', 'paladin', 'wizard'].includes(sheet.classId);

// План заклять персонажа: пули виборів, підготовка, завжди підготовлені
export function spellPlan(sheet) {
  const L = clamp(Number(sheet.level) || 1, 1, 20);
  const key = spellCasterKey(sheet);
  const sub = sheet.subclassId;
  const slots = spellSlots(sheet.classId, L, sub);
  const maxLevel = slots.reduce((m, n, i) => (n > 0 ? i + 1 : m), 0);
  const third = !!THIRD_SCHOOLS[key];
  const list = third ? 'wizard' : sheet.classId;
  const ab = casterInfo(sheet.classId, sub).ability;
  const m = ab ? mod(sheet.abilities[ab]) : 0;
  const ch = sheet.choices || {};
  const pools = [];
  const always = [];
  const ct = atLv(CANTRIPS_KNOWN[key], L);
  if (ct) pools.push({ id: 'cantrips', name: 'Замовляння', count: ct, lists: [list], min: 0, max: 0 });
  if (sheet.raceId === 'high_elf') pools.push({ id: 'raceCantrip', name: 'Замовляння високого ельфа', count: 1, lists: ['wizard'], min: 0, max: 0 });
  const rdp = RACE_DATA[sheet.raceId];
  if (rdp && rdp.cantrips && (!rdp.cantrips.when || (ch[rdp.cantrips.when[0]] || []).includes(rdp.cantrips.when[1]))) pools.push({ id: 'raceCantrip', name: rdp.cantrips.name, count: rdp.cantrips.count, lists: rdp.cantrips.lists, min: 0, max: 0 });
  if (sheet.classId === 'cleric' && sub === 'nature') pools.push({ id: 'bonusCantrip', name: 'Замовляння друїда (домен природи)', count: 1, lists: ['druid'], min: 0, max: 0 });
  if (sheet.classId === 'druid' && sub === 'land' && L >= 2) pools.push({ id: 'bonusCantrip', name: 'Додаткове замовляння (коло землі)', count: 1, lists: ['druid'], min: 0, max: 0 });
  if (sheet.classId === 'warlock' && (ch.pactBoon || []).includes('tome')) pools.push({ id: 'tome', name: 'Книга тіней (замовляння будь-яких класів)', count: 3, lists: ANY_LIST, min: 0, max: 0 });
  if ((sheet.feats || []).includes('magic_initiate')) {
    pools.push({ id: 'miCantrips', name: 'Ініціат магії: замовляння', count: 2, lists: ANY_LIST, min: 0, max: 0 });
    pools.push({ id: 'miSpell', name: 'Ініціат магії: закляття 1 кола', count: 1, lists: ANY_LIST, min: 1, max: 1 });
  }
  const known = SPELLS_KNOWN[key] ? SPELLS_KNOWN[key][L - 1] : 0;
  if (known && maxLevel) {
    const p = { id: 'known', name: 'Відомі закляття', count: known, lists: [list], min: 1, max: maxLevel };
    if (key === 'warlock' && PATRON_SPELLS[sub]) p.extra = PATRON_SPELLS[sub];
    if (key === 'bard') { const n = [10, 14, 18].filter((x) => L >= x).length * 2; if (n) { p.offList = n; p.offListName = 'Магічні таємниці'; } }
    if (third) { p.schools = THIRD_SCHOOLS[key]; p.offSchool = [3, 8, 14, 20].filter((x) => L >= x).length; }
    pools.push(p);
  }
  if (sheet.classId === 'wizard') pools.push({ id: 'book', name: 'Книга заклять', count: 6 + 2 * (L - 1), lists: ['wizard'], min: 1, max: maxLevel });
  if (sheet.classId === 'warlock') {
    for (const [lv, sl] of [[11, 6], [13, 7], [15, 8], [17, 9]]) if (L >= lv) pools.push({ id: `arcanum${sl}`, name: `Таємний арканум: ${sl} коло`, count: 1, lists: ['warlock'], min: sl, max: sl });
  }
  if (sheet.classId === 'bard' && sub === 'lore' && L >= 6) pools.push({ id: 'loreSecrets', name: 'Додаткові магічні таємниці', count: 2, lists: ANY_LIST, min: 0, max: maxLevel });
  let prep = null;
  if (['cleric', 'druid', 'paladin'].includes(sheet.classId) && maxLevel) {
    const n = Math.max(1, m + (sheet.classId === 'paladin' ? Math.floor(L / 2) : L));
    prep = { from: 'list', max: n };
    pools.push({ id: 'prep', name: 'Підготовлені закляття', count: n, lists: [sheet.classId], min: 1, max: maxLevel, prep: true });
  }
  if (sheet.classId === 'wizard') prep = { from: 'book', max: Math.max(1, m + L) };
  // Завжди підготовлені
  const addAlways = (ids, src) => { for (const id of ids) if (SPELLS[id] && !always.some((x) => x.sid === id)) always.push({ sid: id, src }); };
  if (sheet.classId === 'cleric' && DOMAIN_SPELLS[sub]) for (const [lv, ids] of Object.entries(DOMAIN_SPELLS[sub])) if (L >= Number(lv)) addAlways(ids, 'Домен');
  if (sheet.classId === 'cleric' && sub === 'light') addAlways(['light'], 'Домен');
  if (sheet.classId === 'paladin' && OATH_SPELLS[sub]) for (const [lv, ids] of Object.entries(OATH_SPELLS[sub])) if (L >= Number(lv)) addAlways(ids, 'Клятва');
  if (sheet.classId === 'druid' && sub === 'land') {
    const land = (ch.land || [])[0];
    if (LAND_SPELLS[land]) for (const [lv, ids] of Object.entries(LAND_SPELLS[land])) if (L >= Number(lv)) addAlways(ids, 'Коло землі');
  }
  if (key === 'arcane_trickster' && L >= 3) addAlways(['mage_hand'], 'Підклас');
  if (sheet.raceId === 'tiefling') addAlways(['thaumaturgy', ...(L >= 3 ? ['hellish_rebuke'] : []), ...(L >= 5 ? ['darkness'] : [])], 'Раса');
  if (rdp) {
    const ids = (rdp.spells || []).filter(([lv]) => L >= lv).map(([, id]) => id).filter((id) => SPELLS[id]);
    if (rdp.choiceSpells) ids.push(...(ch[rdp.choiceSpells] || []).filter((id) => SPELLS[id]));
    if (ids.length) addAlways(ids, 'Раса');
  }
  const sp = sheet.spell || {};
  return {
    key, ability: ab, maxLevel, pools, prep, always,
    swaps: Number(sp.swaps) || 0,
    prepOpen: sp.prepOpen === undefined ? true : !!sp.prepOpen,
    canSwap: canSwapSpell(sheet),
  };
}

// Чи підходить закляття до пулу (без лімітів кількості)
export function spellFitsPool(pool, sp) {
  if (!pool || !sp) return 'немає такого вибору';
  if (pool.max === 0 ? sp.level !== 0 : sp.level === 0) return pool.max === 0 ? 'лише замовляння' : 'не замовляння';
  if (sp.level > pool.max) return `доступно з ${sp.level} кола`;
  if (sp.level && sp.level < pool.min) return `потрібне закляття ${pool.min} кола`;
  const inList = sp.classes.some((c) => pool.lists.includes(c)) || (pool.extra || []).includes(sp.id);
  if (!inList && !pool.offList) return 'не з твого списку';
  return '';
}
const offListOf = (pool, sp) => !(sp.classes.some((c) => pool.lists.includes(c)) || (pool.extra || []).includes(sp.id));
const offSchoolOf = (pool, sp) => !!pool.schools && sp.level > 0 && !pool.schools.includes(sp.school);
const newSpellId = () => Math.random().toString(36).slice(2, 10);

// Перевірка зміни списку заклять. mode: 'create' | 'player' | 'master'.
// Записи: {id, sid, pool, prepared, by:'m'} — закляття з бази; без sid — власні (додає лише майстер).
export function checkSpells(sheet, oldList, newList, mode) {
  const plan = spellPlan(sheet);
  const errors = [];
  const out = [];
  oldList = Array.isArray(oldList) ? oldList : [];
  const oldById = new Map(oldList.map((e) => [e.id, e]));
  const seen = new Set();
  for (const raw of Array.isArray(newList) ? newList : []) {
    if (!raw || typeof raw !== 'object') continue;
    const prev = raw.id ? oldById.get(String(raw.id)) : null;
    if (!raw.sid) {
      // власне закляття: гравець лише залишає його (і може змінити підготовку)
      if (mode === 'master') { out.push({ ...raw }); continue; }
      if (!prev || prev.sid) { errors.push('Власні закляття додає лише майстер'); continue; }
      out.push({ ...prev, prepared: !!raw.prepared });
      continue;
    }
    const sp = SPELLS[raw.sid];
    if (!sp) { errors.push('Невідоме закляття'); continue; }
    if (seen.has(sp.id) && mode !== 'master') { errors.push(`«${sp.name}» вже є у списку`); continue; }
    seen.add(sp.id);
    const by = prev ? prev.by : mode === 'master' ? 'm' : undefined;
    const pool = String(raw.pool || (prev && prev.pool) || (mode === 'master' ? 'extra' : ''));
    const e = { id: prev ? prev.id : newSpellId(), sid: sp.id, pool, name: sp.name, level: sp.level, prepared: pool === 'prep' ? true : !!raw.prepared };
    if (by) e.by = by;
    if (prev && prev.pool !== pool && mode !== 'master') { errors.push(`«${sp.name}»: не можна переносити між списками`); continue; }
    out.push(e);
  }
  if (mode === 'master') return { errors, list: out, plan };
  const mine = out.filter((e) => e.sid && e.by !== 'm');
  for (const e of mine) {
    const pool = plan.pools.find((p) => p.id === e.pool);
    const why = pool ? spellFitsPool(pool, SPELLS[e.sid]) : 'немає місця для такого закляття';
    const isOld = oldById.has(e.id);
    if (why && !isOld) errors.push(`«${e.name}»: ${why}`);
  }
  for (const p of plan.pools) {
    const inPool = mine.filter((e) => e.pool === p.id);
    const added = inPool.filter((e) => !oldById.has(e.id)).length;
    if (inPool.length > p.count && added) errors.push(`${p.name}: максимум ${p.count}`);
    if (p.offList) {
      const off = inPool.filter((e) => offListOf(p, SPELLS[e.sid])).length;
      if (off > p.offList && added) errors.push(`${p.offListName}: з інших списків максимум ${p.offList}`);
    }
    if (p.schools) {
      const off = inPool.filter((e) => offSchoolOf(p, SPELLS[e.sid])).length;
      if (off > p.offSchool && added) errors.push(`${p.name}: шкіл, крім «${p.schools.join('» і «')}», максимум ${p.offSchool}`);
    }
  }
  // Підготовка
  const prepCount = plan.prep && plan.prep.from === 'book'
    ? out.filter((e) => e.prepared && e.level > 0 && (e.pool === 'book' || !e.sid)).length
    : 0;
  let swapsUsed = 0;
  let prepChanged = false;
  if (mode === 'player') {
    for (const old of oldList) {
      const now = out.find((e) => e.id === old.id);
      if (now) { if (!!now.prepared !== !!old.prepared && old.pool !== 'prep') prepChanged = true; continue; }
      if (!old.sid || old.by === 'm') errors.push(`«${old.name}» може прибрати лише майстер`);
      else if (old.pool === 'prep') prepChanged = true;
      else if (old.pool === 'known') swapsUsed++;
      else errors.push(`«${old.name}» не можна прибрати — лише майстер`);
    }
    if (out.some((e) => e.pool === 'prep' && !oldById.has(e.id))) prepChanged = true;
    if (prepChanged && !plan.prepOpen) errors.push('Змінювати підготовлені закляття можна після довгого відпочинку або підвищення рівня');
    if (swapsUsed > plan.swaps) errors.push(plan.canSwap ? 'Замінити відоме закляття можна лише одне за підвищення рівня' : 'Відомі закляття не можна прибрати');
  }
  if (plan.prep && plan.prep.from === 'book' && prepCount > plan.prep.max && (mode === 'create' || prepChanged)) errors.push(`Підготовлених заклять — максимум ${plan.prep.max}`);
  return { errors: [...new Set(errors)], list: out, plan, swapsUsed, prepChanged };
}

// Скільки ще можна обрати в кожному пулі
export function spellPoolUsage(sheet, list) {
  const plan = spellPlan(sheet);
  return plan.pools.map((p) => ({ ...p, used: (list || []).filter((e) => e.sid && e.by !== 'm' && e.pool === p.id).length }));
}

// ================= Витрати дій у бою (5e, PHB 2014; зілля — бонусною дією) =================
// cost: action — дія, bonus — бонусна дія, reaction — реакція, free — без витрати, haste — додаткова дія від «Прискорення»
export const COSTS = ['action', 'bonus', 'reaction', 'free', 'haste'];
export const COST_NAMES = { action: 'Дія', bonus: 'Бонусна дія', reaction: 'Реакція', free: 'Без витрати', haste: 'Дія прискорення' };
export const COST_ICONS = { action: '●', bonus: '◐', reaction: '⚡', free: '○', haste: '⏩' };
// стан ходу учасника бою
export const TURN_BLANK = { action: 0, bonus: 0, reaction: 0, haste: 0, attacks: 0, battacks: 0, atk: 0, atkN: 0, w: {}, ids: [], spells: [], surged: 0, gwm: 0, readied: 0, allow: 0, ask: null, pending: null, dmg: null, last: null };
export const turnState = (t) => ({ ...TURN_BLANK, ...(t || {}) });

// Властивості зброї для правил бою
const POLEARMS = ['glaive', 'halberd', 'quarterstaff', 'spear'];
export function weaponTags(d) {
  if (!d || d.natural) return { melee: true, unarmed: true, monk: true, oneHanded: true };
  const p = String(d.props || '').toLowerCase();
  const id = d.catalogId || d.kind || '';
  const twoHanded = p.includes('дворуч');
  const heavy = p.includes('важк');
  const melee = !d.ranged;
  return {
    melee, light: p.includes('легк'), heavy, twoHanded, oneHanded: !twoHanded,
    polearm: melee && (POLEARMS.includes(id) || /^(глефа|алебарда|бойовий посох|спис)$/i.test(d.name || '')),
    handCrossbow: id === 'hand_crossbow' || /ручний арбалет/i.test(d.name || ''),
    // зброя монаха: короткий меч і проста зброя ближнього бою без «дворучна» й «важка»
    monk: melee && !twoHanded && !heavy && (id === 'shortsword' || d.cat === 'simple_melee' || /^Проста ближнього/.test(d.group || '')),
  };
}
export const martialDie = (s) => (s.level >= 17 ? 10 : s.level >= 11 ? 8 : s.level >= 5 ? 6 : 4);

const hasFeat = (s, id) => (s.feats || []).includes(id);
const isSub = (s, cls, sub, lvl = 1) => s.classId === cls && s.subclassId === sub && s.level >= lvl;
const isCls = (s, cls, lvl = 1) => s.classId === cls && s.level >= lvl;
let SPELL_BY_NAME = null;
export function spellByName(name) {
  if (!SPELL_BY_NAME) SPELL_BY_NAME = new Map(Object.values(SPELLS).map((x) => [x.name, x]));
  return SPELL_BY_NAME.get(name) || null;
}
export function spellCastCost(sp) {
  const tm = (sp && sp.time) || '1 дія';
  if (/бонусн/.test(tm)) return 'bonus';
  if (/реакц/.test(tm)) return 'reaction';
  if (/^1 дія/.test(tm)) return 'action';
  return 'long';
}

// Стани, що забирають дії, реакції чи рух
const INCAP = ['unconscious', 'paralyzed', 'petrified', 'stunned', 'incapacitated'];
const NO_MOVE = ['paralyzed', 'petrified', 'stunned', 'unconscious', 'grappled', 'restrained'];
export function turnLimits(sheet, effects) {
  const fx = effects || [];
  const keys = new Set(fx.map((e) => e.key).filter(Boolean));
  const exh = fx.find((e) => e.key === 'exhaustion');
  const inc = INCAP.find((k) => keys.has(k));
  const nm = NO_MOVE.find((k) => keys.has(k));
  return {
    down: !!(sheet.hp && sheet.hp.cur <= 0),
    incap: sheet.hp && sheet.hp.cur <= 0 ? 'Без тями (0 ХП) — лише рятівні кидки від смерті' : inc ? `Стан «${EFFECTS[inc].name}» — ні дій, ні реакцій` : '',
    noMove: nm ? `Стан «${EFFECTS[nm].name}» — швидкість 0` : exh && exh.n >= 5 ? 'Виснаження 5 — швидкість 0' : '',
    haste: keys.has('haste'), slow: keys.has('slow'), rage: keys.has('rage'),
  };
}

// Чи вільна витрата в цьому ході
function costLeft(t, cost, lim, kind) {
  if (cost === 'free') return '';
  if (cost === 'reaction') return lim.slow ? 'Уповільнення — без реакцій' : t.reaction ? 'Реакцію вже використано' : '';
  if (cost === 'haste') return !lim.haste ? 'Немає «Прискорення»' : t.haste ? 'Дію прискорення вже використано' : '';
  if (cost === 'bonus') {
    if (t.bonus) return 'Бонусну дію вже використано';
    if (lim.slow && t.action) return 'Уповільнення — або дія, або бонусна дія';
    return '';
  }
  // дія: атаки, що лишились у дії «Атака», не потребують нової дії
  if (kind === 'attack' && t.attacks > 0) return '';
  if (t.action) return kind === 'attack' && t.atk ? 'Атак у цій дії не лишилось' : 'Дію вже використано';
  if (lim.slow && t.bonus) return 'Уповільнення — або дія, або бонусна дія';
  return '';
}
const opt = (cost, note = '', extra = null, more = {}) => ({ cost, note, extra, ...more });

// Режими атаки: звичайна (дія «Атака»), бонусні атаки за вміннями й рисами, атака реакцією
export const ATTACK_MODES = {
  main: { name: 'Атака', cost: 'action' },
  haste: { name: 'Атака прискорення', cost: 'haste' },
  offhand: { name: 'Друга зброя', cost: 'bonus', note: 'Бій двома зброями' },
  martial: { name: 'Удар без зброї', cost: 'bonus', note: 'Бойові мистецтва' },
  flurry: { name: 'Шквал ударів', cost: 'bonus', note: '2 удари · 1 ці', extra: { ki: 1 }, strikes: 2 },
  flurry2: { name: 'Ще удар шквалу', cost: 'free', note: 'Шквал ударів' },
  polearm: { name: 'Тупий кінець древка', cost: 'bonus', note: 'Майстер древкової зброї' },
  crossbow: { name: 'Ручний арбалет', cost: 'bonus', note: 'Експерт арбалета' },
  gwm: { name: 'Атака великою зброєю', cost: 'bonus', note: 'Майстер великої зброї' },
  frenzy: { name: 'Шаленство', cost: 'bonus', note: 'Берсерк у люті' },
  warpriest: { name: 'Атака жерця війни', cost: 'bonus', note: 'Жрець війни', extra: { warPriest: 1 } },
  battlemagic: { name: 'Атака після закляття', cost: 'bonus', note: 'Бойова магія' },
  racial: { name: 'Расова атака', cost: 'bonus', note: 'Раса' },
  reaction: { name: 'Атака реакцією', cost: 'reaction', note: 'Атака при нагоді' },
};
// які предмети годяться для режиму (id 0 — беззбройний удар)
export function modeWeapons(mode, sheet, weapons, t) {
  const W = [...weapons, { id: 0, d: null, qty: 1 }];
  const tg = (w) => weaponTags(w.d);
  const dual = hasFeat(sheet, 'dual_wielder');
  switch (mode) {
    case 'offhand': return weapons.filter((w) => { const x = tg(w); return x.melee && (x.light || (dual && x.oneHanded)) && ((t.ids || []).some((i) => i !== w.id) || !(t.ids || []).includes(w.id) || w.qty > 1); });
    case 'martial': case 'flurry': case 'flurry2': return W.filter((w) => w.id === 0);
    case 'polearm': return weapons.filter((w) => tg(w).polearm);
    case 'crossbow': return weapons.filter((w) => tg(w).handCrossbow);
    case 'gwm': return weapons.filter((w) => tg(w).melee);
    case 'frenzy': case 'reaction': return W.filter((w) => tg(w).melee);
    case 'racial': { const b = (raceData(sheet) || {}).batk; return b ? weapons.filter((w) => w.id === b.w) : []; }
    default: return W;
  }
}
// чи є в персонажа такий режим атаки взагалі
function hasMode(mode, sheet, ctx, t, lim) {
  const W = ctx.weapons || [];
  const dual = hasFeat(sheet, 'dual_wielder');
  switch (mode) {
    case 'main': case 'reaction': return true;
    case 'haste': return lim.haste;
    // дві зброї: хоча б дві легкі (з рисою — одноручні) зброї ближнього бою
    case 'offhand': return W.filter((w) => { const x = weaponTags(w.d); return x.melee && (x.light || (dual && x.oneHanded)); }).reduce((a, w) => a + Math.max(1, w.qty || 1), 0) >= 2;
    case 'martial': return isCls(sheet, 'monk');
    case 'flurry': return isCls(sheet, 'monk', 2);
    case 'flurry2': return t.battacks > 0 && t.bmode === 'flurry';
    case 'polearm': return hasFeat(sheet, 'polearm_master') && W.some((w) => weaponTags(w.d).polearm);
    case 'crossbow': return hasFeat(sheet, 'crossbow_expert') && W.some((w) => weaponTags(w.d).handCrossbow);
    case 'gwm': return hasFeat(sheet, 'gwm');
    case 'frenzy': return isSub(sheet, 'barbarian', 'berserker', 3);
    case 'warpriest': return isSub(sheet, 'cleric', 'war');
    case 'battlemagic': return isSub(sheet, 'bard', 'valor', 14) || isSub(sheet, 'fighter', 'eldritch_knight', 7);
    case 'racial': return !!(raceData(sheet) || {}).batk;
    default: return false;
  }
}
// умова режиму в цьому ході ('' — виконано)
function modeCond(mode, sheet, ctx, t, lim) {
  const res = ctx.res || {};
  switch (mode) {
    case 'offhand': return !t.atk ? 'Спершу атакуй дією «Атака» легкою зброєю' : !(t.w.light || (hasFeat(sheet, 'dual_wielder') && t.w.oneMelee)) ? 'Потрібна атака легкою зброєю ближнього бою' : '';
    case 'martial': return !t.atk ? 'Спершу атакуй дією «Атака»' : !t.w.monk ? 'Потрібна атака без зброї чи зброєю монаха' : '';
    case 'flurry': return !t.atk ? 'Одразу після дії «Атака»' : (res.ki || 0) < 1 ? 'Немає очок ці' : '';
    case 'polearm': return !t.atk || !t.w.polearm ? 'Спершу атакуй дією «Атака» древковою зброєю' : '';
    case 'crossbow': return !t.atk || !t.w.oneHanded ? 'Спершу атакуй дією «Атака» одноручною зброєю' : '';
    case 'gwm': return !t.gwm ? 'Після крита чи вбивства зброєю ближнього бою в цьому ході' : '';
    case 'frenzy': return !lim.rage ? 'Лише в люті' : '';
    case 'warpriest': return !t.atk ? 'Спершу атакуй дією «Атака»' : (res.warPriest || 0) < 1 ? 'Використання скінчились' : '';
    case 'racial': {
      const b = (raceData(sheet) || {}).batk;
      if (!b) return '';
      return b.need === 'dash' && !t.dashed ? 'Спершу Ривок' : b.res && (res[b.res] || 0) < 1 ? 'Використання скінчились' : '';
    }
    case 'battlemagic': {
      const bard = isSub(sheet, 'bard', 'valor', 14);
      const okSp = (t.spells || []).some((x) => x.cost === 'action' && (bard || x.lvl === 0 || sheet.level >= 18));
      return okSp ? '' : !bard && sheet.level < 18 ? 'Спершу замовляння дією' : 'Спершу закляття дією';
    }
    default: return '';
  }
}
// назва, примітка й ціна режиму (расова атака — з даних раси)
export function modeInfo(mode, sheet) {
  const M = ATTACK_MODES[mode];
  if (mode !== 'racial') return M;
  const b = (raceData(sheet) || {}).batk;
  return b ? { ...M, name: b.n, note: (raceData(sheet) || {}).n || M.note, extra: b.res ? { [b.res]: 1 } : null } : M;
}
// чи доступний режим атаки зараз: { ok, why, has }
export function attackMode(mode, sheet, ctx) {
  const t = turnState(ctx.t);
  const lim = turnLimits(sheet, ctx.effects);
  const M = ATTACK_MODES[mode];
  if (!M) return { ok: false, has: false, why: 'Невідомий режим атаки' };
  const has = hasMode(mode, sheet, ctx, t, lim);
  const myTurn = ctx.myTurn !== false;
  const why = (!myTurn && M.cost !== 'reaction' ? 'Зараз не твій хід' : '')
    || lim.incap
    || (lim.slow && t.atkN >= 1 ? 'Уповільнення — лише одна атака за хід' : '')
    || modeCond(mode, sheet, ctx, t, lim)
    || (mode === 'flurry2' ? '' : costLeft(t, M.cost, lim, mode === 'main' ? 'attack' : ''));
  return { ok: has && !why, has, why: has ? why : 'Немає такого вміння' };
}
export function attackModeList(sheet, ctx) {
  const myTurn = ctx.myTurn !== false;
  return Object.keys(ATTACK_MODES)
    .filter((mode) => (myTurn ? mode !== 'reaction' : mode === 'reaction'))
    .map((mode) => ({ mode, ...modeInfo(mode, sheet), ...attackMode(mode, sheet, ctx) }))
    .filter((m) => m.has);
}

// Витрати, дозволені правилами для дії: [{cost, note, extra}], why — чому нічого не можна
export function turnOptions(sheet, req, ctx) {
  const t = turnState(ctx.t);
  const lim = turnLimits(sheet, ctx.effects);
  const res = ctx.res || {};
  const L = sheet.level;
  const myTurn = ctx.myTurn !== false;
  let opts = [];
  let why = '';
  let anytime = false;
  const k = req.kind;
  if (k === 'attack') {
    const M = ATTACK_MODES[req.mode || 'main'] && modeInfo(req.mode || 'main', sheet);
    if (!M) return { opts: [], why: 'Невідомий режим атаки' };
    const r = attackMode(req.mode || 'main', sheet, ctx);
    const cond = r.has ? modeCond(req.mode || 'main', sheet, ctx, t, lim) : r.why;
    if (cond) why = cond;
    else opts = [opt(M.cost, M.note || '', M.extra || null)];
    if (lim.slow && t.atkN >= 1) why = 'Уповільнення — лише одна атака за хід';
    anytime = M.cost === 'reaction';
  } else if (k === 'spell') {
    const sp = spellByName(req.name);
    const base = spellCastCost(sp);
    if (lim.rage) why = 'У люті не можна творити закляття';
    else if (base === 'long') why = `Закляття твориться ${sp ? sp.time : ''} — довше за хід`;
    else {
      opts = [opt(base)];
      if (base === 'action' && ((sheet.choices || {}).metamagic || []).includes('quickened')) opts.push(opt('bonus', 'Прискорене закляття · 2 очки', { sorcery: 2 }));
      anytime = base === 'reaction';
      // правило бонусного закляття: того ходу інші закляття — лише замовляння дією
      if (myTurn) {
        const cantripAct = sp && sp.level === 0 && base === 'action';
        const prior = t.spells || [];
        opts = opts.map((o) => {
          if (o.cost === 'bonus' && prior.some((x) => !(x.lvl === 0 && x.cost === 'action'))) return { ...o, why: 'Закляття бонусною дією — лише якщо інші закляття цього ходу були замовляннями дією' };
          if (prior.some((x) => x.cost === 'bonus') && !(cantripAct && o.cost === 'action')) return { ...o, why: 'Після закляття бонусною дією — лише замовляння дією' };
          return o;
        });
      }
    }
  } else if (k === 'std') {
    const a = req.act;
    const cunning = isCls(sheet, 'rogue', 2);
    const ki = isCls(sheet, 'monk', 2);
    if (a === 'move') { opts = [opt('free')]; if (lim.noMove) why = lim.noMove; }
    else {
      opts = [opt('action')];
      if (['dash', 'disengage'].includes(a)) {
        if (cunning) opts.push(opt('bonus', 'Хитра дія'));
        else if (ki) opts.push(opt('bonus', 'Крок вітру · 1 ці', { ki: 1 }));
      }
      if (a === 'dodge' && ki) opts.push(opt('bonus', 'Терпляча оборона · 1 ці', { ki: 1 }));
      if (a === 'hide') {
        if (cunning) opts.push(opt('bonus', 'Хитра дія'));
        else if (isCls(sheet, 'ranger', 14)) opts.push(opt('bonus', 'Зникнення'));
      }
      if (a === 'object' && isSub(sheet, 'rogue', 'thief', 3)) opts.push(opt('bonus', 'Швидкі руки'));
      // раса: «Спритна втеча» гобліна, «Прилив адреналіну» орка, «Дар фей» хобгобліна…
      const rs = ((raceData(sheet) || {}).std || {})[a];
      if (rs) {
        const ro = opt('bonus', rs.note, rs.res ? { [rs.res]: 1 } : null);
        const i = opts.findIndex((o) => o.cost === 'bonus');
        if (i < 0) opts.push(ro); else if (opts[i].extra && !ro.extra) opts[i] = ro;
      }
      if (['dash', 'disengage', 'hide', 'object'].includes(a)) opts.push(opt('haste', 'Прискорення'));
    }
  } else if (k === 'check') {
    const key = String(req.key || '');
    const cunning = isCls(sheet, 'rogue', 2);
    if (key === 'skill:athletics') {
      // захоплення чи штовхання — замість однієї атаки з дії «Атака»
      opts = [opt('action', 'Захоплення / штовхання замість атаки', null, { attack: true })];
      if (hasFeat(sheet, 'shield_master') && t.atk) opts.push(opt('bonus', 'Майстер щита: поштовх'));
      else if ((raceData(sheet) || {}).hammer && t.atk) opts.push(opt('bonus', 'Молотові роги: поштовх'));
    } else if (key === 'skill:stealth') {
      opts = [opt('action', 'Сховатися')];
      if (cunning) opts.push(opt('bonus', 'Хитра дія'));
      else if (isCls(sheet, 'ranger', 14)) opts.push(opt('bonus', 'Зникнення'));
      opts.push(opt('haste', 'Прискорення'));
    } else if (key === 'skill:sleight_of_hand') {
      opts = [opt('action')];
      if (isSub(sheet, 'rogue', 'thief', 3)) opts.push(opt('bonus', 'Швидкі руки'));
    } else if (['skill:perception', 'skill:investigation'].includes(key)) opts = [opt('action', 'Пошук')];
    else opts = [opt('action')];
  } else if (k === 'item') {
    const d = req.item || {};
    if (d.type === 'potion') opts = [opt('bonus', 'Випити самому'), opt('action', 'Напоїти іншого')];
    else {
      opts = [opt('action')];
      if (isSub(sheet, 'rogue', 'thief', 3) && !['scroll', 'wand', 'rod', 'staff'].includes(d.type) && (d.rarity || 'common') === 'common' && !d.bonus) opts.push(opt('bonus', 'Швидкі руки'));
    }
    if (d.type !== 'scroll') opts.push(opt('haste', 'Прискорення'));
  } else if (k === 'feature') {
    const id = req.resId;
    switch (id) {
      case 'rage': case 'inspiration': case 'secondWind': opts = [opt('bonus')]; break;
      case 'channel':
        opts = [opt('action')];
        if (isSub(sheet, 'paladin', 'vengeance', 3)) opts.push(opt('bonus', 'Обітниця ворожнечі'));
        if (isSub(sheet, 'cleric', 'war', 2)) opts.push(opt('free', 'Керований удар'));
        if (isSub(sheet, 'cleric', 'war', 6)) opts.push(opt('reaction', 'Благословення бога війни'));
        if (isSub(sheet, 'cleric', 'tempest', 2)) opts.push(opt('free', 'Руйнівний гнів'));
        break;
      case 'wildshape': opts = [opt('action')]; if (isSub(sheet, 'druid', 'moon', 2)) opts.push(opt('bonus', 'Бойова дика подоба')); break;
      case 'actionSurge':
        opts = [opt('free', 'Повертає дію')];
        if (t.surged) why = 'Сплеск дій — лише раз за хід';
        break;
      case 'indomitable': case 'strokeOfLuck': case 'relentless': opts = [opt('free')]; anytime = true; break;
      case 'superiority': opts = [opt('free', 'Прийом під час атаки'), opt('bonus', 'Прийом бонусною дією'), opt('reaction', 'Прийом реакцією')]; anytime = true; break;
      case 'ki': opts = [opt('free', 'Приголомшливий удар')]; break;
      case 'sorcery': opts = [opt('bonus', 'Комірка ↔ очки'), opt('free', 'Метамагія')]; break;
      case 'arcaneRecovery': why = 'Лише під час короткого відпочинку'; break;
      case 'warPriest': why = 'Використовується через «⚔️ Атака» → «Атака жерця війни»'; break;
      default: {
        // ресурси раси: ціна з даних раси
        const rr = raceResDefs(sheet).find((r) => r.id === id);
        if (rr) {
          if ((raceData(sheet) || {}).batk && raceData(sheet).batk.res === id) { why = `Використовується через «⚔️ Атака» → «${raceData(sheet).batk.n}»`; break; }
          const std = Object.values((raceData(sheet) || {}).std || {}).find((x) => x.res === id);
          if (std) { why = `Використовується через «🏃 Інші дії» (${std.note})`; break; }
          opts = rr.cost.map((c) => opt(c, rr.note || ''));
          anytime = !!rr.any || rr.cost.includes('reaction');
        } else opts = [opt('action')];
      }
    }
  } else if (k === 'rfeat') {
    // уміння й риси, що спрацьовують реакцією; підготовлена дія
    opts = [opt('reaction', req.name === 'ready' ? 'Підготовлена дія' : '')];
    anytime = true;
  } else why = 'Невідома дія';
  // поза своїм ходом — лише реакції та вміння «без дії»
  if (!myTurn) {
    opts = opts.filter((o) => o.cost === 'reaction' || (anytime && o.cost === 'free'));
    if (!opts.length && !why) why = 'Зараз не твій хід — лише реакція';
  }
  if (!lim.haste) opts = opts.filter((o) => o.cost !== 'haste');
  // стани
  const incapOk = k === 'feature' && req.resId === 'relentless';
  if (lim.incap && !incapOk && !why) why = lim.incap;
  // що з цього ще вільне
  opts = opts.map((o) => {
    if (o.why) return { ...o, ok: false };
    const w = costLeft(t, o.cost, lim, o.attack || k === 'attack' ? 'attack' : '');
    const ex = o.extra && Object.entries(o.extra).find(([r, n]) => (res[r] || 0) < n);
    return { ...o, ok: !w && !ex, why: w || (ex ? 'Не вистачає ресурсу' : '') };
  });
  return { opts, why };
}
// Що обрати за замовчуванням: перша вільна витрата
export const defaultOption = (r) => (r.opts.find((o) => o.ok) || r.opts[0] || null);
export const turnCostLeft = (t, cost, lim, kind) => costLeft(turnState(t), cost, lim, kind);
export const hasFightingStyle = hasStyle;
// Уміння й риси, що спрацьовують реакцією (окрім атаки при нагоді й заклять-реакцій)
export function reactionFeatures(sheet) {
  const out = [];
  const seen = new Set();
  for (const f of sheet.features || []) {
    if (!/реакцією/i.test(f.desc || '') || /^Канал/.test(f.name || '') || seen.has(f.name) || raceResDefs(sheet).some((r) => r.n === f.name)) continue;
    seen.add(f.name);
    out.push({ id: `f:${f.name}`, name: f.name, desc: f.desc });
  }
  for (const id of ['defensive_duelist', 'mage_slayer', 'sentinel', 'war_caster']) {
    const ft = FEATS.find((x) => x.id === id);
    if (ft && hasFeat(sheet, id)) out.push({ id: `feat:${id}`, name: ft.name, desc: ft.desc });
  }
  if (hasStyle(sheet, 'protection')) out.push({ id: 'style:protection', name: 'Захист', desc: 'Зі щитом реакцією дай перешкоду атаці по союзнику поруч.' });
  return out;
}
