// Правила D&D 5e (SRD 5.1, CC-BY-4.0), спільні для Mini App і сервера.

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
export const SKILL_IDS = Object.keys(SKILLS);

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

// Масив кількості комірок по колам (індекс 0 = 1-ше коло)
export function spellSlots(classId, level) {
  const c = CLASSES[classId];
  if (!c) return [];
  level = clamp(level, 1, 20);
  if (c.caster === 'full') return FULL_SLOTS[level].slice();
  if (c.caster === 'half') return level < 2 ? [] : FULL_SLOTS[Math.ceil(level / 2)].slice();
  if (c.caster === 'pact') {
    const count = level === 1 ? 1 : level <= 10 ? 2 : level <= 16 ? 3 : 4;
    const slotLevel = Math.min(5, Math.ceil(level / 2));
    const arr = new Array(slotLevel).fill(0);
    arr[slotLevel - 1] = count;
    return arr;
  }
  return [];
}

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
  return spellSlots(sheet.classId, sheet.level);
}

export function spellAbility(sheet) {
  return (sheet.spell && sheet.spell.ability) || (CLASSES[sheet.classId] && CLASSES[sheet.classId].spellAbility) || 'int';
}

// items: [{data, equipped}]
export function computeAC(sheet, items) {
  if (sheet.acOverride != null && sheet.acOverride !== '') return Number(sheet.acOverride);
  const dex = mod(sheet.abilities.dex);
  let base = null;
  let shield = 0;
  let bonus = Number(sheet.acBonus || 0);
  for (const it of items || []) {
    if (!it.equipped) continue;
    const d = it.data || {};
    if (d.type === 'armor' && d.ac) {
      const cap = d.dexMax == null || d.dexMax === '' ? 99 : Number(d.dexMax);
      const v = Number(d.ac) + Math.min(dex, cap) + Number(d.bonus || 0);
      base = base == null ? v : Math.max(base, v);
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
  }
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
  const hit = abMod + sheetProf(sheet) + magic;
  const dmgMod = abMod + magic;
  const dmg = d.damage ? `${d.damage}${dmgMod ? (dmgMod > 0 ? '+' + dmgMod : dmgMod) : ''} ${d.dmgType || ''}`.trim() : '—';
  return { hit, dmg };
}

export function passivePerception(sheet) {
  return 10 + skillValue(sheet, 'perception');
}

export function emptyMoney() { return { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }; }

export function newSheetTemplate() {
  return {
    name: '', raceId: '', classId: '', backgroundId: '', subclass: '', alignment: '',
    level: 1, xp: 0, targetLevel: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saves: [], skills: {},
    hp: { max: 1, cur: 1, temp: 0 }, hitDiceUsed: 0, deathSaves: { s: 0, f: 0 }, inspiration: false,
    speed: 30, acBonus: 0, acOverride: null, initBonus: 0, profOverride: null,
    text: {}, spell: { ability: null, slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0], slotsOverride: null, spells: [] },
    money: emptyMoney(),
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

  // Хіти
  const hp = cls.hd + mod(abil.con) + (race.hpPerLevel || 0);
  s.hp = { max: Math.max(1, hp), cur: Math.max(1, hp), temp: 0 };
  s.spell.ability = cls.spellAbility || null;
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
