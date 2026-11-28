// Перевірка перекладів: знаходить українські тексти в коді, яких немає в i18n/ru.js чи i18n/en.js.
// Запуск з кореня репозиторію: npm i --no-save acorn acorn-walk && node i18n/tools/missing.mjs
// Нові переклади додаються прямо в i18n/ru.js та i18n/en.js: «'український текст': 'переклад'».
// Змінні: {0}, {1}… — будь-який текст (перекладається окремо), # — число.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const require = createRequire(path.join(ROOT, 'package.json'));
let acorn; let walk;
try { acorn = require('acorn'); walk = require('acorn-walk'); } catch (e) {
  console.error('Потрібні пакети: npm i --no-save acorn acorn-walk');
  process.exit(2);
}
const CYR = /[А-ЯҐЄІЇа-яґєії]/;
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const FILES = [['app.js', 'html'], ['worker/index.js', 'msg'], ['shared/rules.js', 'msg'], ['shared/details.js', 'msg'], ['shared/gear.js', 'msg'],
  ['shared/glossary.js', 'msg'], ['shared/classdata.js', 'msg'], ['data/items.js', 'msg'], ['shared/spells.js', 'msg'], ['shared/races.js', 'msg']];
// вирази, що вставляють HTML (розривають текст на окремі вузли)
const HTMLISH = /<|\bab\(|abbrify\(|map\(abbrify|compAbbr\(|infoBtn\(|Html\(|LOGO\(|footerHtml|textSection\(|hdr\(|empty\(|pickList\(|numIn\(|opts\(/;
const renum = (seg) => { let i = 0; const map = {}; return seg.replace(/\{(\d+)\}/g, (x, n) => { if (!(n in map)) map[n] = i++; return `{${map[n]}}`; }); };
const useful = (k) => CYR.test(k) && k.replace(/\{\d+\}/g, '').replace(/[\s.,:;!?()«»"'—–\-+×·/№%0-9]/g, '').length >= 2;
const gen = (s) => (/^[+−-]?\d+(?:[.,]\d+)?(?:\/\d+)?\s?[А-ЯҐЄІЇа-яґєії.]{1,6}$/.test(s) ? s.replace(/\d+(?:[.,]\d+)?/g, '#') : s);
// навмисно без перекладу: регулярні вирази й службові шматки
const SKIP = [/^(дворуч|важк|легк)$/, /^\(\?<!/, /\\p\{/, /^фехтув$/, /^\$\d/, /^(заклинач|дварф)$/,
  // форми множини одиниць тривалості ефектів (FX_FORMS) — підставляються вже потрібною мовою
  /^(раунд|раунди|раундів|хвилина|хвилини|хвилин|година|години|годин|день|дні|днів|раунда|раундов|минута|минуты|минут|час|часа|часов|дня|дней)$/];

const keys = new Map();
const add = (k, where) => { k = gen(norm(k)); if (useful(k) && !SKIP.some((r) => r.test(k)) && !keys.has(k)) keys.set(k, where); };
for (const [file, mode] of FILES) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  walk.full(ast, (node) => {
    const where = `${file}:${node.loc && node.loc.start.line}`;
    if (node.type === 'Literal' && typeof node.value === 'string' && CYR.test(node.value)) {
      if (mode === 'html') {
        for (const seg of node.value.split(/<[^>]*>/)) add(seg, where);
        for (const a of node.value.matchAll(/(?:placeholder|title|aria-label)="([^"]*)"/g)) add(a[1], where);
      } else for (const line of node.value.split('\n')) add(line, where);
    }
    if (node.type === 'TemplateLiteral' && node.quasis.some((q) => CYR.test(q.value.cooked))) {
      let s = '';
      node.quasis.forEach((q, i) => {
        s += q.value.cooked;
        if (i < node.expressions.length) s += mode === 'html' && HTMLISH.test(src.slice(node.expressions[i].start, node.expressions[i].end)) ? '<x>' : `{${i}}`;
      });
      if (mode === 'html') {
        for (const a of s.matchAll(/(?:placeholder|title|aria-label)="([^"]*)"/g)) add(renum(a[1]), where);
        for (const seg of s.split(/<[^>]*>/)) add(renum(seg), where);
      } else for (const line of s.split('\n')) add(renum(line), where);
    }
  });
}
let total = 0;
for (const lang of ['ru', 'en']) {
  const dict = (await import(path.join(ROOT, `i18n/${lang}.js`))).default;
  const have = new Set(Object.keys(dict).map(norm));
  const miss = [...keys].filter(([k]) => !have.has(k) && !k.startsWith('" data-'));
  total += miss.length;
  console.log(`${lang}: ${miss.length} без перекладу з ${keys.size}`);
  for (const [k, w] of miss) console.log(`  ${w}  ${k}`);
}
process.exit(total ? 1 : 0);
