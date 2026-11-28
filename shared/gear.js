// Володіння (обладунки, зброя, інструменти, мови) та стартове спорядження за Книгою гравця D&D 5e.
import { CATALOG_BY_ID, WEAPON_INFO } from '../data/items.js';

// ---------- Довідники ----------
export const ITEM_CATS = {
  simple_melee: 'Проста зброя ближнього бою', simple_ranged: 'Проста зброя дальнього бою',
  martial_melee: 'Військова зброя ближнього бою', martial_ranged: 'Військова зброя дальнього бою',
  light: 'Легкий обладунок', medium: 'Середній обладунок', heavy: 'Важкий обладунок',
};
export const WEAPON_CAT_IDS = ['simple_melee', 'simple_ranged', 'martial_melee', 'martial_ranged'];
export const ARMOR_CAT_IDS = ['light', 'medium', 'heavy'];
export const ARMOR_PROF = { light: 'Легкі обладунки', medium: 'Середні обладунки', heavy: 'Важкі обладунки', shield: 'Щити' };
export const WEAPON_PROF = { simple: 'Проста зброя', martial: 'Військова зброя', ...Object.fromEntries(Object.entries(WEAPON_INFO).map(([id, w]) => [id, w.name])) };

export const LANGUAGES = {
  common: 'Загальна', dwarvish: 'Дварфійська', elvish: 'Ельфійська', giant: 'Велетнів', gnomish: 'Гномська', goblin: 'Гоблінська',
  halfling: 'Напіврослицька', orc: 'Орківська', abyssal: 'Безодні', celestial: 'Небесна', draconic: 'Драконяча', deep: 'Глибинна',
  infernal: 'Інфернальна', primordial: 'Первісна', sylvan: 'Сильванська', undercommon: 'Підземна',
  aquan: 'Акванська', gith: 'Гітська', grung: 'Грунгська', leonin: 'Леонінська', loxodon: 'Локсодонська', quori: 'Кворі', vedalken: 'Ведалкенська',
  druidic: 'Друїдська (таємна)', cant: 'Злодійський жаргон',
};
export const LANG_CHOOSABLE = Object.keys(LANGUAGES).filter((k) => !['druidic', 'cant'].includes(k));

export const TOOL_GROUPS = {
  artisan: { name: 'Інструменти ремісників', ids: ['alchemists_supplies', 'brewers_supplies', 'calligraphers_supplies', 'carpenters_tools', 'cartographers_tools', 'cobblers_tools',
    'cooks_utensils', 'glassblowers_tools', 'jewelers_tools', 'leatherworkers_tools', 'masons_tools', 'painters_supplies', 'potters_tools', 'smiths_tools', 'tinkers_tools',
    'weavers_tools', 'woodcarvers_tools'] },
  gaming: { name: 'Гральні набори', ids: ['dice_set', 'dragonchess_set', 'playing_cards', 'three_dragon_ante'] },
  instrument: { name: 'Музичні інструменти', ids: ['bagpipes', 'drum', 'dulcimer', 'flute', 'lute', 'lyre', 'horn', 'pan_flute', 'shawm', 'viol'] },
  other: { name: 'Інше', ids: ['disguise_kit', 'forgery_kit', 'herbalism_kit', 'navigators_tools', 'poisoners_kit', 'thieves_tools', 'vehicles_land', 'vehicles_water'] },
};
const TOOL_EXTRA = { vehicles_land: 'Наземний транспорт', vehicles_water: 'Водний транспорт', dice_set: 'Гральні кістки', playing_cards: 'Гральні карти' };
export const TOOLS = Object.fromEntries(Object.values(TOOL_GROUPS).flatMap((g) => g.ids).map((id) => [id, TOOL_EXTRA[id] || (CATALOG_BY_ID[id] ? CATALOG_BY_ID[id].name : id)]));
const toolIds = (from) => [].concat(from).flatMap((f) => (TOOL_GROUPS[f] ? TOOL_GROUPS[f].ids : f === 'any' ? Object.keys(TOOLS) : [f]));

// ---------- Джерела володінь ----------
// armor/weapons/tools/languages — фіксовані; tool/lang — вибір {count, from}
const CASTER_WEAPONS = ['dagger', 'dart', 'sling', 'quarterstaff', 'light_crossbow'];
const ROGUE_WEAPONS = ['simple', 'hand_crossbow', 'longsword', 'rapier', 'shortsword'];
export const CLASS_PROF = {
  barbarian: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'] },
  bard: { armor: ['light'], weapons: ROGUE_WEAPONS, tool: { count: 3, from: 'instrument' } },
  cleric: { armor: ['light', 'medium', 'shield'], weapons: ['simple'] },
  druid: { armor: ['light', 'medium', 'shield'], weapons: ['club', 'dagger', 'dart', 'javelin', 'mace', 'quarterstaff', 'scimitar', 'sickle', 'sling', 'spear'], tools: ['herbalism_kit'], languages: ['druidic'] },
  fighter: { armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'] },
  monk: { weapons: ['simple', 'shortsword'], tool: { count: 1, from: ['artisan', 'instrument'] } },
  paladin: { armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'] },
  ranger: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'] },
  rogue: { armor: ['light'], weapons: ROGUE_WEAPONS, tools: ['thieves_tools'], languages: ['cant'] },
  sorcerer: { weapons: CASTER_WEAPONS },
  warlock: { armor: ['light'], weapons: ['simple'] },
  wizard: { weapons: CASTER_WEAPONS },
};
export const RACE_PROF = {
  hill_dwarf: { weapons: ['battleaxe', 'handaxe', 'light_hammer', 'warhammer'], tool: { count: 1, from: ['smiths_tools', 'brewers_supplies', 'masons_tools'] }, languages: ['common', 'dwarvish'] },
  high_elf: { weapons: ['longsword', 'shortsword', 'shortbow', 'longbow'], languages: ['common', 'elvish'], lang: 1 },
  lightfoot_halfling: { languages: ['common', 'halfling'] },
  human: { languages: ['common'], lang: 1 },
  dragonborn: { languages: ['common', 'draconic'] },
  rock_gnome: { tools: ['tinkers_tools'], languages: ['common', 'gnomish'] },
  half_elf: { languages: ['common', 'elvish'], lang: 1 },
  half_orc: { languages: ['common', 'orc'] },
  tiefling: { languages: ['common', 'infernal'] },
};
export const BG_PROF = {
  acolyte: { lang: 2 },
  charlatan: { tools: ['disguise_kit', 'forgery_kit'] },
  criminal: { tools: ['thieves_tools'], tool: { count: 1, from: 'gaming' } },
  entertainer: { tools: ['disguise_kit'], tool: { count: 1, from: 'instrument' } },
  folk_hero: { tools: ['vehicles_land'], tool: { count: 1, from: 'artisan' } },
  guild_artisan: { tool: { count: 1, from: 'artisan' }, lang: 1 },
  hermit: { tools: ['herbalism_kit'], lang: 1 },
  noble: { tool: { count: 1, from: 'gaming' }, lang: 1 },
  outlander: { tool: { count: 1, from: 'instrument' }, lang: 1 },
  sage: { lang: 2 },
  sailor: { tools: ['navigators_tools', 'vehicles_water'] },
  soldier: { tools: ['vehicles_land'], tool: { count: 1, from: 'gaming' } },
  urchin: { tools: ['disguise_kit', 'thieves_tools'] },
  custom: { tool: { count: 1, from: 'any' }, lang: 1 },
};
export const SUBCLASS_PROF = {
  'cleric.life': { armor: ['heavy'] },
  'cleric.nature': { armor: ['heavy'] },
  'cleric.tempest': { armor: ['heavy'], weapons: ['martial'] },
  'cleric.war': { armor: ['heavy'], weapons: ['martial'] },
  'cleric.knowledge': { lang: 2 },
  'bard.valor': { armor: ['medium', 'shield'], weapons: ['martial'] },
  'rogue.assassin': { tools: ['disguise_kit', 'poisoners_kit'] },
  'fighter.battle_master': { tool: { count: 1, from: 'artisan' } },
};
export const FEAT_PROF = {
  lightly_armored: { armor: ['light'] },
  moderately_armored: { armor: ['medium', 'shield'] },
  heavily_armored: { armor: ['heavy'] },
};

function sources(sheet) {
  return [
    ['race', 'раси', RACE_PROF[sheet.raceId]],
    ['class', 'класу', CLASS_PROF[sheet.classId]],
    ['bg', 'передісторії', BG_PROF[sheet.backgroundId]],
    ['sub', 'підкласу', SUBCLASS_PROF[`${sheet.classId}.${sheet.subclassId}`]],
    ...(sheet.feats || []).map((f) => ['feat', 'риси', FEAT_PROF[f]]),
  ].filter(([, , d]) => d);
}
const emptyProf = () => ({ armor: [], weapons: [], tools: [], languages: [] });
const add = (arr, ids) => { for (const id of ids || []) if (!arr.includes(id)) arr.push(id); };

// Фіксовані володіння (без виборів)
export function fixedProf(sheet) {
  const p = emptyProf();
  for (const [, , d] of sources(sheet)) { add(p.armor, d.armor); add(p.weapons, d.weapons); add(p.tools, d.tools); add(p.languages, d.languages); }
  return p;
}
// Специфікації виборів: [{id, name, kind:'tool'|'lang', count, from:[ids]}]
export function profChoiceSpecs(sheet) {
  const out = [];
  for (const [src, label, d] of sources(sheet)) {
    if (src === 'feat') continue;
    if (d.tool) out.push({ id: `${src}:tool`, name: `Інструменти ${label}`, kind: 'tool', count: d.tool.count, from: toolIds(d.tool.from) });
    if (d.lang) out.push({ id: `${src}:lang`, name: `Мови ${label}`, kind: 'lang', count: d.lang, from: LANG_CHOOSABLE });
  }
  return out;
}
// Володіння з виборами. picks: {'race:lang': [...], ...}
export function buildProf(sheet, picks = {}) {
  const errors = [];
  const p = fixedProf(sheet);
  for (const spec of profChoiceSpecs(sheet)) {
    const arr = spec.kind === 'tool' ? p.tools : p.languages;
    const sel = [...new Set(Array.isArray(picks[spec.id]) ? picks[spec.id].map(String) : [])];
    const ok = sel.filter((x) => spec.from.includes(x) && !arr.includes(x));
    if (ok.length !== spec.count) { errors.push(`${spec.name}: обери ${spec.count}`); }
    add(arr, ok.slice(0, spec.count));
  }
  return { prof: p, errors };
}
// Володіння листа (для старих персонажів — фіксовані за расою, класом і передісторією)
export const profOf = (sheet) => (sheet.prof && typeof sheet.prof === 'object' ? { ...emptyProf(), ...sheet.prof } : fixedProf(sheet));
// Додати фіксовані володіння нового підкласу чи риси (при підвищенні рівня)
export function grantProf(sheet, key, table) {
  const d = table[key];
  if (!d || !sheet.prof) return;
  add(sheet.prof.armor, d.armor); add(sheet.prof.weapons, d.weapons); add(sheet.prof.tools, d.tools); add(sheet.prof.languages, d.languages);
}

// ---------- Категорії предметів і перевірка володіння ----------
export function itemCat(d) {
  if (!d) return '';
  if (d.cat && ITEM_CATS[d.cat]) return d.cat;
  const c = d.catalogId && CATALOG_BY_ID[d.catalogId];
  if (c && c.cat) return c.cat;
  const k = weaponKind(d);
  return k && WEAPON_INFO[k] ? WEAPON_INFO[k].cat : '';
}
export function weaponKind(d) {
  if (!d || d.type !== 'weapon') return '';
  if (d.kind && WEAPON_INFO[d.kind]) return d.kind;
  const c = d.catalogId && CATALOG_BY_ID[d.catalogId];
  return (c && c.kind) || '';
}
// null — невідомо (вважаємо, що володіє)
export function weaponProficient(sheet, d) {
  const cat = itemCat(d);
  const kind = weaponKind(d);
  if (!cat && !kind) return null;
  const w = profOf(sheet).weapons;
  return (cat && w.includes(cat.split('_')[0])) || (kind && w.includes(kind));
}
export function armorProficient(sheet, d) {
  if (!d) return null;
  if (d.type === 'shield') return profOf(sheet).armor.includes('shield');
  if (d.type !== 'armor') return null;
  const cat = itemCat(d);
  if (!cat) return null;
  return profOf(sheet).armor.includes(cat);
}

// ---------- Стартове спорядження ----------
// Опція — список [id, кількість]; '@simple', '@martial_melee' тощо — вибір конкретної речі.
export const PICKS = {
  '@simple': { name: 'будь-яка проста зброя', ids: () => Object.keys(WEAPON_INFO).filter((k) => WEAPON_INFO[k].cat.startsWith('simple')) },
  '@simple_melee': { name: 'будь-яка проста зброя ближнього бою', ids: () => Object.keys(WEAPON_INFO).filter((k) => WEAPON_INFO[k].cat === 'simple_melee') },
  '@martial': { name: 'будь-яка військова зброя', ids: () => Object.keys(WEAPON_INFO).filter((k) => WEAPON_INFO[k].cat.startsWith('martial')) },
  '@martial_melee': { name: 'будь-яка військова зброя ближнього бою', ids: () => Object.keys(WEAPON_INFO).filter((k) => WEAPON_INFO[k].cat === 'martial_melee') },
  '@instrument': { name: 'музичний інструмент на вибір', ids: () => TOOL_GROUPS.instrument.ids },
  '@artisan': { name: 'інструменти ремісника на вибір', ids: () => TOOL_GROUPS.artisan.ids },
  '@gaming': { name: 'гральний набір на вибір', ids: () => TOOL_GROUPS.gaming.ids },
};
export const CLASS_EQUIP = {
  barbarian: { groups: [[[['greataxe']], [['@martial_melee']]], [[['handaxe', 2]], [['@simple']]]], fixed: [['explorers_pack'], ['javelin', 4]], gold: [2, 10] },
  bard: { groups: [[[['rapier']], [['longsword']], [['@simple']]], [[['diplomats_pack']], [['entertainers_pack']]], [[['lute']], [['@instrument']]]], fixed: [['leather'], ['dagger']], gold: [5, 10] },
  cleric: { groups: [[[['mace']], [['warhammer']]], [[['scale_mail']], [['leather']], [['chain_mail']]], [[['light_crossbow'], ['bolt', 20]], [['@simple']]], [[['priests_pack']], [['explorers_pack']]]],
    fixed: [['shield'], ['holy_symbol']], gold: [5, 10], req: { g0o1: 'warhammer', g1o2: 'heavy' } },
  druid: { groups: [[[['shield']], [['@simple']]], [[['scimitar']], [['@simple_melee']]]], fixed: [['leather'], ['explorers_pack'], ['druidic_focus']], gold: [2, 10] },
  fighter: { groups: [[[['chain_mail']], [['leather'], ['longbow'], ['arrow', 20]]], [[['@martial'], ['shield']], [['@martial'], ['@martial']]], [[['light_crossbow'], ['bolt', 20]], [['handaxe', 2]]],
    [[['dungeoneers_pack']], [['explorers_pack']]]], fixed: [], gold: [5, 10] },
  monk: { groups: [[[['shortsword']], [['@simple']]], [[['dungeoneers_pack']], [['explorers_pack']]]], fixed: [['dart', 10]], gold: [5, 1] },
  paladin: { groups: [[[['@martial'], ['shield']], [['@martial'], ['@martial']]], [[['javelin', 5]], [['@simple_melee']]], [[['priests_pack']], [['explorers_pack']]]],
    fixed: [['chain_mail'], ['holy_symbol']], gold: [5, 10] },
  ranger: { groups: [[[['scale_mail']], [['leather']]], [[['shortsword', 2]], [['@simple_melee'], ['@simple_melee']]], [[['dungeoneers_pack']], [['explorers_pack']]]],
    fixed: [['longbow'], ['quiver'], ['arrow', 20]], gold: [5, 10] },
  rogue: { groups: [[[['rapier']], [['shortsword']]], [[['shortbow'], ['quiver'], ['arrow', 20]], [['shortsword']]], [[['burglars_pack']], [['dungeoneers_pack']], [['explorers_pack']]]],
    fixed: [['leather'], ['dagger', 2], ['thieves_tools']], gold: [4, 10] },
  sorcerer: { groups: [[[['light_crossbow'], ['bolt', 20]], [['@simple']]], [[['component_pouch']], [['arcane_focus']]], [[['dungeoneers_pack']], [['explorers_pack']]]],
    fixed: [['dagger', 2]], gold: [3, 10] },
  warlock: { groups: [[[['light_crossbow'], ['bolt', 20]], [['@simple']]], [[['component_pouch']], [['arcane_focus']]], [[['scholars_pack']], [['dungeoneers_pack']]]],
    fixed: [['leather'], ['@simple'], ['dagger', 2]], gold: [4, 10] },
  wizard: { groups: [[[['quarterstaff']], [['dagger']]], [[['component_pouch']], [['arcane_focus']]], [[['scholars_pack']], [['explorers_pack']]]], fixed: [['spellbook']], gold: [4, 10] },
};
// Речі передісторії; '@bgtool' — інструмент, обраний у володіннях передісторії
export const BG_EQUIP = {
  acolyte: { items: [['holy_symbol'], ['prayer_book'], ['incense', 5], ['vestments'], ['clothes_common'], ['pouch']], gp: 15 },
  charlatan: { items: [['clothes_fine'], ['disguise_kit'], ['con_tools'], ['pouch']], gp: 15 },
  criminal: { items: [['crowbar'], ['clothes_common'], ['pouch']], gp: 15 },
  entertainer: { items: [['@bgtool'], ['admirer_favor'], ['costume'], ['pouch']], gp: 15 },
  folk_hero: { items: [['@bgtool'], ['shovel'], ['iron_pot'], ['clothes_common'], ['pouch']], gp: 10 },
  guild_artisan: { items: [['@bgtool'], ['letter'], ['clothes_travelers'], ['pouch']], gp: 15 },
  hermit: { items: [['scroll_case_notes'], ['winter_blanket'], ['clothes_common'], ['herbalism_kit']], gp: 5 },
  noble: { items: [['clothes_fine'], ['signet_ring'], ['scroll_pedigree'], ['pouch']], gp: 25 },
  outlander: { items: [['quarterstaff'], ['hunting_trap'], ['trophy'], ['clothes_travelers'], ['pouch']], gp: 10 },
  sage: { items: [['ink'], ['ink_pen'], ['knife_small'], ['letter'], ['clothes_common'], ['pouch']], gp: 10 },
  sailor: { items: [['club'], ['rope_silk'], ['lucky_charm'], ['clothes_common'], ['pouch']], gp: 10 },
  soldier: { items: [['insignia'], ['trophy'], ['@bgtool'], ['clothes_common'], ['pouch']], gp: 10 },
  urchin: { items: [['knife_small'], ['map_city'], ['pet_mouse'], ['token_parents'], ['clothes_common'], ['pouch']], gp: 10 },
  custom: { items: [['clothes_common'], ['pouch']], gp: 10 },
};
// Вміст наборів (розгортаються в окремі предмети)
export const PACKS = {
  explorers_pack: [['backpack'], ['bedroll'], ['mess_kit'], ['tinderbox'], ['torch', 10], ['rations', 10], ['waterskin'], ['rope_hemp']],
  dungeoneers_pack: [['backpack'], ['crowbar'], ['hammer'], ['piton', 10], ['torch', 10], ['tinderbox'], ['rations', 10], ['waterskin'], ['rope_hemp']],
  burglars_pack: [['backpack'], ['ball_bearings'], ['string'], ['bell'], ['candle', 5], ['crowbar'], ['hammer'], ['piton', 10], ['lantern_hooded'], ['oil', 2], ['rations', 5], ['tinderbox'], ['waterskin'], ['rope_hemp']],
  priests_pack: [['backpack'], ['blanket'], ['candle', 10], ['tinderbox'], ['alms_box'], ['incense', 2], ['censer'], ['vestments'], ['rations', 2], ['waterskin']],
  scholars_pack: [['backpack'], ['book'], ['ink'], ['ink_pen'], ['parchment', 10], ['sand_bag'], ['knife_small']],
  diplomats_pack: [['chest'], ['case_map', 2], ['clothes_fine'], ['ink'], ['ink_pen'], ['lamp'], ['oil', 2], ['paper', 5], ['perfume'], ['sealing_wax'], ['soap']],
  entertainers_pack: [['backpack'], ['bedroll'], ['costume', 2], ['candle', 5], ['rations', 5], ['waterskin'], ['disguise_kit']],
};
export const itemLabel = (id) => (PICKS[id] ? PICKS[id].name : CATALOG_BY_ID[id] ? CATALOG_BY_ID[id].name : id);
export const optionLabel = (opt) => opt.map(([id, q]) => `${itemLabel(id)}${q > 1 ? ` ×${q}` : ''}`).join(' + ');
export const startGoldText = (classId) => { const g = (CLASS_EQUIP[classId] || {}).gold; return g ? `${g[0]}к4${g[1] > 1 ? ` × ${g[1]}` : ''} ЗМ` : ''; };

// Перелік предметів стартового спорядження.
// sel: {gold:bool, opts:[індекс опції на групу], picks:{ключ: id}} ; profPicks — вибори володінь (для речей передісторії)
// Ключ вибору: g{група}o{опція}i{позиція} або f{позиція}. Повертає {items:[[id, qty]], gp, errors, gold}
// Чи можна взяти опцію «якщо володієш» (напр. бойовий молот чи кольчугу жерця)
export function equipOptionAllowed(classId, key, prof) {
  const r = ((CLASS_EQUIP[classId] || {}).req || {})[key];
  if (!r || !prof) return true;
  if (r === 'heavy') return prof.armor.includes('heavy');
  return prof.weapons.includes(r) || prof.weapons.includes(WEAPON_INFO[r].cat.split('_')[0]);
}
export function resolveEquipment(classId, backgroundId, sel = {}, profPicks = {}, prof = null) {
  const ce = CLASS_EQUIP[classId];
  const errors = [];
  if (!ce) return { items: [], gp: 0, errors: ['Невідомий клас'], gold: false };
  if (sel.gold) return { items: [], gp: 0, errors, gold: true };
  const picks = sel.picks || {};
  const raw = [];
  const take = (entry, key) => {
    const [id, q = 1] = entry;
    if (PICKS[id]) {
      const v = picks[key];
      if (!v || !PICKS[id].ids().includes(v)) { errors.push(`Обери: ${PICKS[id].name}`); return; }
      raw.push([v, q]);
    } else raw.push([id, q]);
  };
  ce.groups.forEach((g, gi) => {
    const oi = Number((sel.opts || [])[gi]);
    if (!Number.isInteger(oi) || !g[oi]) { errors.push('Обери варіант для кожного пункту спорядження'); return; }
    if (!equipOptionAllowed(classId, `g${gi}o${oi}`, prof)) { errors.push(`${optionLabel(g[oi])}: потрібне володіння`); return; }
    g[oi].forEach((entry, ii) => take(entry, `g${gi}o${oi}i${ii}`));
  });
  ce.fixed.forEach((entry, i) => take(entry, `f${i}`));
  const be = BG_EQUIP[backgroundId] || BG_EQUIP.custom;
  for (const [id, q = 1] of be.items) {
    if (id === '@bgtool') {
      const t = ((profPicks['bg:tool'] || [])[0]);
      if (t && CATALOG_BY_ID[t]) raw.push([t, q]);
    } else raw.push([id, q]);
  }
  // розгортаємо набори й об’єднуємо однакові речі
  const map = new Map();
  const push = (id, q) => { if (CATALOG_BY_ID[id]) map.set(id, (map.get(id) || 0) + q); };
  for (const [id, q] of raw) {
    if (PACKS[id]) for (let i = 0; i < q; i++) for (const [pid, pq = 1] of PACKS[id]) push(pid, pq);
    else push(id, q);
  }
  return { items: [...map.entries()], gp: be.gp, errors: [...new Set(errors)], gold: false };
}
