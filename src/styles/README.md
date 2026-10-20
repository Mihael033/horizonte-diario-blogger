# Design system Horizonte

O conceito é a linha do horizonte. A marca fica de pé sobre ela, e o sol nasce no logo, no pé, nos títulos de bloco e no indicador da seção atual. Em modo escuro, o sol se põe e aparece a lua.

- **Paleta**: azul-noite (tinta), cobalto de azulejo (marca e links), amarelo "sol/albero" (destaques) e vermelho só para "Última hora". Cada seção tem a sua cor.
- **Tipografia**: Newsreader (serif feita para jornal) nos títulos e Schibsted Grotesk (sans de grupo de mídia) no texto.

## Onde está cada coisa

| Arquivo | O quê |
|---|---|
| `src/tokens.json` | Fonte única: cores (claro/escuro), seções, fontes, escala fluida, espaço, layout, movimento. |
| `tools/lib/css.mjs` | Gera `b:skin` (`<Variable>` + `:root`), o CSS principal (com `@layer`) e os tokens literais. |
| `src/styles/*.css` | CSS por camada: `reset, base, layout, components, pages, motion, utilities`. |
| `src/theme/parts/*.xml` | Marcação de apresentação no XML do Blogger. |
| `tests/tokens.test.mjs` | Contraste AA de todos os pares, saúde do skin e ausência de cor literal. |

## Tokens (use sempre `var(--…)`, nunca valor literal)

- **Cor**: `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-ink`, `--color-ink-soft`, `--color-muted`, `--color-rule`, `--color-horizon`, `--color-accent`, `--color-accent-ink`, `--color-sun`, `--color-sun-ink`, `--color-live`, `--color-focus`, `--color-footer`, `--color-footer-ink`. O modo escuro troca os valores sozinho.
- **Seção**: `--sec`. Vale dentro de qualquer elemento com `data-section="<Etiqueta>"`; sem seção conhecida, cai no cobalto.
- **Fonte**: `font: var(--font-title)` ou `font: var(--font-text)`. São shorthands, então depois deles ajuste `font-size`, `font-weight` e `line-height`.
- **Escala fluida**: `--step--2` … `--step-6`. Base de 17 a 19 px. `--step--1` é o texto pequeno de UI.
- **Espaço fluido**: `--space-3xs`, `2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`, `3xl`.
- **Layout**: `--container` (84rem), `--measure` (68ch), `--gutter`, `--radius-s|m|pill`, `--header-h`.
- **Movimento**: `--ease-out`, `--ease-in-out`, `--dur-1` … `--dur-4`.
- **Breakpoints** (sintaxe de intervalo): `(width >= 40em)`, `(width >= 48em)`, `(width >= 64em)`.

## Componentes prontos (prefixo `c-`)

`c-button` (`--sun`, `--ghost`), `c-iconbtn`, `c-card` (variantes pelo contêiner `[data-card=secondary|standard|list|row|compact]` ou pela classe `c-card--x`), `c-section-head` (`__title`, `__rule`, `__more`, `--small`), `c-breadcrumbs`, `c-tags`/`c-tag`, `c-pager`, `c-inline-search`, `c-prose`, `c-section-block`, `c-ranked`, `c-newsletter`, `c-toc`, `c-share`, `c-toast`.

Layout (`l-`): `l-container`, `l-page` (a grade da página, com barra lateral), `l-grid`, `l-list`, `l-rail`.

## Regras

1. Só tokens: nada de cor, fonte, espaçamento ou duração literal. O teste falha com `#hex` no CSS.
2. Classes BEM com prefixo: `l-`, `c-`, `p-` (página), `u-`, estados `is-`/`has-`. O JS só usa `data-js` e `aria-*`.
3. Propriedades lógicas (`inline`/`block`) em vez de `left`/`top`/`width`/`height`.
4. Foco visível sempre (`:focus-visible` com `--color-focus`). Alvo de toque mínimo de 44 px.
5. Movimento só com `prefers-reduced-motion: no-preference`. A camada `motion` já zera tudo no `reduce`.
6. Comentário XML nunca pode conter dois hífens seguidos (o validador quebra), e isso inclui nomes BEM como `c-card` seguido do modificador.
7. Antes de entregar: `npx stylelint "src/styles/**/*.css"` e `npm test`.

## Páginas secundárias

`src/styles/pages/`: `home.css` (portada), `article.css` (notícia), `archive.css` (etiqueta, busca e hemeroteca), `static.css` (páginas estáticas) e `error.css` (404), todas em `@layer pages`.

## Como ver

`npm run preview` gera o `preview/` a partir do próprio `theme.xml`, e `npm run dev` o serve em http://localhost:4173 com as rotas do Blogger.
