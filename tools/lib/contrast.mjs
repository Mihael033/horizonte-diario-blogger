// Contraste WCAG 2.x entre cores hex (#RGB ou #RRGGBB).

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Pares que o tema usa de verdade: [texto, fundo, mínimo].
// 4.5 = texto normal (AA); 3 = texto grande, ícones e anel de foco (AA).
export function themePairs(tokens, mode) {
  const c = Object.fromEntries(Object.entries(tokens.color).map(([k, v]) => [k, v[mode]]));
  const pairs = [];
  for (const bg of ['bg', 'surface', 'surface-2']) {
    for (const fg of ['ink', 'ink-soft', 'muted', 'accent', 'live']) pairs.push([`${fg} / ${bg}`, c[fg], c[bg], 4.5]);
    pairs.push([`focus / ${bg}`, c.focus, c[bg], 3]);
    for (const [slug, s] of Object.entries(tokens.section)) {
      if (slug.startsWith('$')) continue;
      pairs.push([`section.${slug} / ${bg}`, s[mode], c[bg], 4.5]);
    }
  }
  pairs.push(['accent-ink / accent', c['accent-ink'], c.accent, 4.5]);
  pairs.push(['sun-ink / sun', c['sun-ink'], c.sun, 4.5]);
  // Pé, ticker e boletim (fundo azul-noite): texto claro, títulos e rótulo em sol, foco em sol.
  pairs.push(['footer-ink / footer', c['footer-ink'], c.footer, 4.5]);
  pairs.push(['sun / footer (Última hora, títulos do pé)', c.sun, c.footer, 4.5]);
  pairs.push(['ink / bg (campo do boletim)', c.ink, c.bg, 4.5]);
  for (const [slug, s] of Object.entries(tokens.section)) {
    if (slug.startsWith('$')) continue;
    // Texto e ícones sobre a cor da seção (avatar da assinatura, selos).
    pairs.push([`accent-ink / section.${slug}`, c['accent-ink'], s[mode], 4.5]);
  }
  pairs.push(['sun / bg (marca gráfica)', c.sun, c.bg, mode === 'dark' ? 3 : 1.5]);
  return pairs.map(([name, fg, bg, min]) => ({ name, fg, bg, min, ratio: contrast(fg, bg) }));
}
