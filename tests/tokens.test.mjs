// Testes do design system: contraste WCAG dos tokens e saúde do CSS gerado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { themePairs } from '../tools/lib/contrast.mjs';
import { buildSkin, buildCss, buildTokensCss, CSS_FILES } from '../tools/lib/css.mjs';

const tokens = JSON.parse(await readFile(new URL('../src/tokens.json', import.meta.url), 'utf8'));

for (const mode of ['light', 'dark']) {
  test(`contraste AA de todos os pares de tokens (${mode})`, () => {
    const fails = themePairs(tokens, mode).filter((p) => p.ratio < p.min);
    assert.deepEqual(
      fails.map((p) => `${p.name}: ${p.ratio.toFixed(2)} < ${p.min}`),
      [],
    );
  });
}

test('b:skin tem uma <Variable> por token de cor, seção e fonte, com nomes sem hífen', async () => {
  const skin = await buildSkin();
  const names = [...skin.matchAll(/<Variable name="([^"]+)"/g)].map((m) => m[1]);
  const colors = Object.keys(tokens.color).filter((k) => !k.startsWith('$')).length;
  const sections = Object.keys(tokens.section).filter((k) => !k.startsWith('$')).length;
  assert.equal(names.length, colors * 2 + sections * 2 + 2);
  assert.equal(new Set(names).size, names.length, 'nomes de Variable repetidos');
  for (const n of names) assert.match(n, /^[a-z]+(\.[a-z]+)+$/, `nome inválido: ${n}`);
  // Toda variável declarada é usada e toda usada é declarada.
  const used = new Set([...skin.matchAll(/\$\(([^)]+)\)/g)].map((m) => m[1]));
  assert.deepEqual([...used].sort(), [...names].sort());
});

test('b:skin não usa sintaxe arriscada para o minificador do Blogger', async () => {
  const skin = await buildSkin();
  const css = skin.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const bad of ['@layer', '@container', '@property', '&', ']]>']) {
    assert.ok(!css.includes(bad), `b:skin contém ${bad}`);
  }
});

test('CSS principal: sem "]]>", com todas as camadas e sem cor literal fora dos tokens', async () => {
  const css = await buildCss({ minified: false });
  assert.ok(!css.includes(']]>'));
  assert.match(css, /@layer reset, base, layout, components, pages, motion, utilities;/);
  // Cores literais só são aceitas nas máscaras (preto opaco de mask-image).
  const hex = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]).filter((h) => h !== '#000');
  assert.deepEqual(hex, [], `cores literais no CSS: ${hex.join(', ')}`);
});

test('nenhuma página do preview repete view-transition-name (a transição seria cancelada)', async (t) => {
  const { readdir } = await import('node:fs/promises');
  const root = new URL('../preview/', import.meta.url);
  let files;
  try {
    files = (await readdir(root, { recursive: true })).filter((f) => f.endsWith('.html'));
  } catch {
    t.skip('preview/ ainda não gerado (npm run preview)');
    return;
  }
  const bad = [];
  for (const f of files) {
    const html = await readFile(new URL(f.replaceAll('\\', '/'), root), 'utf8');
    const names = [...html.matchAll(/view-transition-name:\s*([\w-]+)/g)].map((m) => m[1]);
    const dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
    if (dup.length) bad.push(`${f}: ${dup.join(', ')}`);
  }
  assert.deepEqual(bad, []);
});

test('todos os arquivos da cascata existem (exceto as páginas ainda por vir)', async () => {
  const optional = new Set(['pages/archive.css', 'pages/static.css', 'pages/error.css', 'fonts.css']);
  for (const f of CSS_FILES) {
    if (optional.has(f)) continue;
    await assert.doesNotReject(readFile(new URL(`../src/styles/${f}`, import.meta.url)), `falta src/styles/${f}`);
  }
});

test('tokens literais do preview batem com os defaults das Variable', async () => {
  const [skin, literal] = await Promise.all([buildSkin(), buildTokensCss()]);
  const accent = tokens.color.accent.light;
  assert.ok(skin.includes(`default="${accent}"`));
  assert.ok(literal.includes(`--color-accent: ${accent};`));
});
