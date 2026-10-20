#!/usr/bin/env node
// Valida un tema de Blogger (por defecto theme/theme.xml). Sirve también para temas ajenos o
// exportados desde Blogger:  node tools/validate.mjs ruta/al/tema.xml [--json]
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTheme, formatReport } from './lib/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const file = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(ROOT, 'theme', 'theme.xml'));

try {
  const text = await readFile(file, 'utf8');
  let map;
  // El mapa de líneas solo vale si es del mismo build que el theme.xml.
  const mapFile = path.join(ROOT, 'dist', 'theme.map.json');
  if (file === path.join(ROOT, 'theme', 'theme.xml')) {
    const [a, b] = await Promise.all([stat(file), stat(mapFile).catch(() => null)]);
    if (b && b.mtimeMs >= a.mtimeMs - 1000) map = JSON.parse(await readFile(mapFile, 'utf8'));
  }
  const report = validateTheme(text, { map });
  if (args.includes('--json')) {
    console.log(JSON.stringify({ ...report, confirm: Object.fromEntries(report.confirm) }, null, 2));
  } else {
    console.log(`Validando ${path.relative(process.cwd(), file) || file}`);
    console.log(formatReport(report));
  }
  process.exitCode = report.errors.length ? 1 : 0;
} catch (err) {
  console.error(`✖  ${err.message}`);
  process.exitCode = 1;
}
