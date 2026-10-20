// Variantes de imagem do preview . Imitam o resizeImage do Blogger:
// <outDir>/<name>-w400.webp … -w1600.webp, cortadas em 16:9.
// Uso: await buildImages({ sources: [{ name, file }], outDir })

import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const WIDTHS = [400, 800, 1200, 1600];
const RATIO = 9 / 16;

async function mtime(file) {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return 0;
  }
}

export async function buildImages({ sources, outDir, widths = WIDTHS, quality = 72 }) {
  const { default: sharp } = await import('sharp');
  await mkdir(outDir, { recursive: true });
  const written = [];
  for (const { name, file } of sources) {
    const srcTime = await mtime(file);
    if (!srcTime) throw new Error(`Imagem não encontrada: ${file}`);
    for (const w of widths) {
      const out = path.join(outDir, `${name}-w${w}.webp`);
      // Cache: só refaz se a original for mais nova que a variante.
      if ((await mtime(out)) >= srcTime) continue;
      await sharp(file)
        .resize(w, Math.round(w * RATIO), { fit: 'cover', position: 'attention', withoutEnlargement: false })
        .webp({ quality, effort: 5 })
        .toFile(out);
      written.push(out);
    }
  }
  return written;
}
