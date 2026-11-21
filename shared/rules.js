// Правила D&D 5e (SRD 5.1, CC-BY-4.0), спільні для Mini App і сервера.
import { CLASS_DATA, FEATS, RACE_TRAITS, RACE_CHOICES, PACT_BOONS, resourceDefs } from './classdata.js';
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
// У алфавітному порядку української назви
export const SKILL_IDS = Object.keys(SKILLS).sort((a, b) => SKILLS[a][0].localeCompare(SKILLS[b][0], 'uk'));
export const sortSkills = (ids) => ids.slice().sort((a, b) => SKILLS[a][0].localeCompare(SKILLS[b][0], 'uk'));

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
export const canCastAnySpell = (sheet) => isCaster(sheet) || ['high_elf', 'tiefling'].includes(sheet.raceId);

export const hdAverage = (hd) => hd / 2 + 1;

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
  proficiencies: 'Володіння та мови',
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
  }
  if (armored && hasStyle(sheet, 'defense')) bonus += 1;
  return base + shield + bonus;
}

export function weaponAttack(sheet, d) {
  const props = (d.props || '').toLowerCase();
  const str = mod(sheet.abilities.str);
  const dex = mod(sheet.abilities.dex);
  let abMod = str;
  if (d.ranged) abMod = dex;
  if (props.includes('фехтув')) abMod = Math.max(str, dex);
  const magic = Number(d.bonus || 0);
  const hit = abMod + sheetProf(sheet) + magic + (d.ranged && hasStyle(sheet, 'archery') ? 2 : 0);
  const dmgMod = abMod + magic;
  const dmg = d.damage ? `${d.damage}${dmgMod ? (dmgMod > 0 ? '+' + dmgMod : dmgMod) : ''} ${d.dmgType || ''}`.trim() : '—';
  return { hit, dmg };
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
export function buildCharacter(input) {
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

  // Хіти
  const hp = cls.hd + mod(abil.con) + hpPerLevelBonus(s);
  s.hp = { max: Math.max(1, hp), cur: Math.max(1, hp), temp: 0 };
  s.spell.ability = null;
  s.text = {};
  for (const k of TEXT_FIELD_IDS) if (input.text && input.text[k]) s.text[k] = String(input.text[k]).slice(0, 4000);
  return { errors, sheet: s };
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
  if (spec.kind === 'skill') return SKILL_IDS.map((k) => ({ id: k, name: SKILLS[k][0], desc: '', disabled: !!sheet.skills[k], reason: sheet.skills[k] ? 'вже є' : '' }));
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
      sheet.features.push({ lvl: newLevel, name: `${cd.subclassLabel}: ${sc.name}`, desc: '', src: 'subclass' });
      for (let L = cd.subclassLevel; L < newLevel; L++) pushF(sheet, subclassFeaturesAt(sheet.classId, sheet.subclassId, L), L, 'subclass');
    }
  }
  pushF(sheet, classFeaturesAt(sheet.classId, newLevel), newLevel, 'class');
  if (sheet.subclassId) pushF(sheet, subclassFeaturesAt(sheet.classId, sheet.subclassId, newLevel), newLevel, 'subclass');
  if (errors.length) return errors;
  const picks = input.choices || {};
  for (const spec of pendingChoices(sheet, newLevel)) {
    const raw = Array.isArray(picks[spec.id]) ? picks[spec.id] : picks[spec.id] ? [picks[spec.id]] : [];
    const sel = [...new Set(raw.map(String))];
    if (sel.length !== spec.need) { errors.push(`${spec.name}: обери ${spec.need}`); continue; }
    const opts = choiceOptions(spec, sheet, newLevel);
    const bad = sel.find((id) => { const op = opts.find((x) => x.id === id); return !op || op.disabled; });
    if (bad) { errors.push(`${spec.name}: недоступний варіант`); continue; }
    sheet.choices[spec.id] = [...(sheet.choices[spec.id] || []), ...sel];
    for (const id of sel) {
      const op = opts.find((x) => x.id === id);
      if (spec.kind === 'skill') sheet.skills[id] = Math.max(1, sheet.skills[id] || 0);
      if (spec.kind === 'expert') sheet.skills[id] = 2;
      for (const k of op.skills || []) sheet.skills[k] = Math.max(1, sheet.skills[k] || 0);
      sheet.features.push({ lvl: newLevel, name: `${spec.name}: ${op.name}`, desc: op.desc || '', src: spec.src || 'choice' });
    }
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
  sheet.features = sheet.features || [];
  sheet.features.push({ lvl: level, name: `Риса: ${ft.name}`, desc: ft.desc + (extra.length ? ` (${extra.join('; ')})` : ''), src: 'feat' });
  return [];
}

// ================= Ресурси й відпочинок =================
export function sheetResources(sheet) {
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, mod(sheet.abilities[a])]));
  const used = sheet.resUsed || {};
  return resourceDefs(sheet.classId, sheet.subclassId, sheet.raceId, sheet.level, mods).map((r) => ({ ...r, used: Math.min(r.max, Number(used[r.id] || 0)) }));
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
