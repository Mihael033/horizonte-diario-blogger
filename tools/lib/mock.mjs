// Datos simulados para el preview, con la misma forma que los da Blogger (layouts v3).
// Fuente: content/posts.json. Todo es ficticio y está marcado como demostración.
import { Rich, raw, escapeHtml, snippetText } from './expr.mjs';

export const SITE = {
  title: 'Horizonte Diario',
  description: 'Periodismo cercano, sin prisa.',
  blogId: '7012345678901234567',
  widths: [400, 800, 1200, 1600],
  searchSample: 'barrio',
  searchEmpty: 'sinresultados',
  postsOnHome: 9,
};

export const PAGES = [
  {
    slug: 'quienes-somos',
    title: 'Quiénes somos',
    body: `<p><strong>Horizonte Diario</strong> es un periódico digital ficticio creado para mostrar este tema de Blogger. Sus noticias, firmas y declaraciones son de demostración.</p>
<h2>Qué contamos</h2>
<p>Actualidad, economía, cultura, tecnología, deportes y opinión, con una idea sencilla: menos ruido y más contexto.</p>
<h2>Cómo trabajamos</h2>
<p>Contrastamos los datos, citamos las fuentes y corregimos a la vista cuando nos equivocamos.</p>`,
  },
  {
    slug: 'contacto',
    title: 'Contacto',
    body: `<p>¿Tienes una pista, una corrección o una propuesta? Escríbenos a <a href="mailto:redaccion@example.com">redaccion@example.com</a>.</p>
<p>Respondemos de lunes a viernes, de 9:00 a 18:00 (hora peninsular).</p>`,
  },
  {
    slug: 'aviso-legal',
    title: 'Aviso legal',
    body: `<p>Texto de ejemplo. Sustitúyelo por el aviso legal de tu publicación: titular del sitio, NIF, domicilio, contacto y condiciones de uso, conforme a la LSSI-CE.</p>`,
  },
  {
    slug: 'privacidad',
    title: 'Política de privacidad',
    body: `<p>Texto de ejemplo. Sustitúyelo por tu política de privacidad conforme al RGPD y a la LOPDGDD: responsable, finalidades, base legal, plazos y derechos.</p>`,
  },
];

const fmtDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
const fmtParts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Europe/Madrid' });
const collator = new Intl.Collator('es', { sensitivity: 'base' });

export const slugify = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Pone la 1ª imagen tras la entradilla (primer párrafo), como recomendamos a la redacción: así el
 * resumen de Blogger (snippet) empieza por el texto y no por el pie de foto.
 */
export function insertAfterLede(html, block) {
  const lead = /^\s*(<aside[\s\S]*?<\/aside>\s*)?/.exec(html)[0].length;
  const end = html.indexOf('</p>', lead);
  if (end === -1) return `${block}\n${html}`;
  const cut = end + 4;
  return `${html.slice(0, cut)}\n${block}\n${html.slice(cut)}`;
}

/** Marcado nativo de Blogger que el tema no controla: html-validate lo ignora (solo en el preview). */
const NATIVE_CONTENT = '<!-- [html-validate-disable-block no-deprecated-attr, void-style, attribute-allowed-values: contenido del editor de Blogger] -->';
const NATIVE_COMMENTS = '<!-- [html-validate-disable-block element-permitted-content, element-permitted-parent, attribute-misuse, no-deprecated-attr, attribute-allowed-values, wcag/h30, prefer-native-element: comentarios nativos de Blogger] -->';

/** Fecha como la pinta Blogger: texto según ajustes + .iso8601. */
const bloggerDate = (iso) => new Rich(fmtDate.format(new Date(iso)), { iso8601: iso });

/**
 * Construye el conjunto de datos del preview.
 * @param {{ posts: any[], ticker: any[], base: string, sections: string[] }} input
 */
export function buildMock({ posts: source, ticker = [], base, sections }) {
  const url = (p) => new URL(p, base).href;
  /** Ruta de una URL del preview relativa a la base (la base puede ser una subcarpeta, p. ej. GitHub Pages). */
  const rel = (u) => decodeURI(String(u).slice(base.length));
  const labelUrl = (name) => url(`search/label/${encodeURIComponent(name)}`);
  const img = (name) => url(`img/${name}`);

  const sorted = [...source].sort((a, b) => new Date(b.date) - new Date(a.date));
  const posts = sorted.map((p, i) => {
    const d = new Date(p.date);
    const [{ value: yyyy }, , { value: mm }] = fmtParts.formatToParts(d);
    const postUrl = url(`${yyyy}/${mm}/${p.slug}.html`);
    const featured = img(`${p.slug}.jpg`);
    // Blogger ordena las etiquetas alfabéticamente: lo imitamos para no esconder errores.
    const labels = [...new Set([p.section, ...(p.tags || [])])].sort(collator.compare).map((name) => ({ name, url: labelUrl(name), count: 0 }));
    const caption = p.image?.credit ? `Foto: ${escapeHtml(p.image.credit)}` : '';
    const firstImage = `<table align="center" cellpadding="0" cellspacing="0" class="tr-caption-container" style="margin-left: auto; margin-right: auto;"><tbody><tr><td style="text-align: center;"><a href="${featured}" style="margin-left: auto; margin-right: auto;"><img alt="${escapeHtml(p.image?.alt || '')}" border="0" data-original-height="900" data-original-width="1600" height="675" src="${img(`${p.slug}-w1200.webp`)}" width="1200"></a></td></tr><tr><td class="tr-caption" style="text-align: center;">${caption}</td></tr></tbody></table>`;
    // La tabla de pie de foto es el marcado del editor de Blogger (atributos antiguos): se excluye de html-validate.
    const body = `${NATIVE_CONTENT}
${insertAfterLede(p.bodyHtml, firstImage)}`;
    return {
      id: String(7001000000000000000n + BigInt((sorted.length - i) * 7919)),
      slug: p.slug,
      title: p.title,
      url: new Rich(postUrl, { canonical: postUrl }),
      link: '',
      body: raw(body),
      date: bloggerDate(p.date),
      lastUpdated: bloggerDate(p.date),
      dateHeader: fmtDate.format(d),
      author: {
        name: p.author.name,
        profileUrl: url('p/quienes-somos.html'),
        authorPhoto: { image: p.author.name === 'Elena Arce' ? img('autores/elena-arce.svg') : '' },
        aboutMe: p.author.role ? `${p.author.role} de ${SITE.title}.` : '',
      },
      labels,
      section: p.section,
      featuredImage: featured,
      firstImageUrl: featured,
      thumbnailUrl: featured,
      numberOfComments: 0,
      allowComments: true,
      allowNewComments: true,
      showThreadedComments: true,
      commentsUrl: `${postUrl}#comments`,
      snippets: { short: p.excerpt || snippetText(p.bodyHtml, { length: 160 }), long: snippetText(p.bodyHtml, { length: 400 }) },
      hasJumpLink: false,
      comments: [],
      _source: p,
    };
  });

  // Recuento de etiquetas y comentarios de ejemplo en la primera noticia.
  const counts = new Map();
  for (const p of posts) for (const l of p.labels) counts.set(l.name, (counts.get(l.name) || 0) + 1);
  for (const p of posts) for (const l of p.labels) l.count = counts.get(l.name);
  if (posts[0]) {
    posts[0].comments = [
      { id: '101', author: 'Marta G.', date: '19 de octubre de 2026, 10:12', body: 'En mi calle llevamos años pidiendo un paso de peatones elevado. Ojalá se escuche a los vecinos.', replies: [
        { id: '102', author: 'Clara Valdés', date: '19 de octubre de 2026, 11:03', body: 'Gracias, Marta. Lo trasladamos a la asociación para el próximo paseo.' },
      ] },
      { id: '103', author: 'Javier R.', date: '19 de octubre de 2026, 12:40', body: 'Muy buen reportaje: se agradece leer algo con calma.', replies: [] },
    ];
    posts[0].numberOfComments = 3;
  }

  const allLabels = [...counts.keys()].sort(collator.compare).map((name) => ({ name, url: labelUrl(name), count: counts.get(name) }));
  const pages = PAGES.map((pg, i) => {
    const pageUrl = url(`p/${pg.slug}.html`);
    return {
      ...pg,
      id: String(7002000000000000000n + BigInt(i + 1)),
      url: new Rich(pageUrl, { canonical: pageUrl }),
      body: raw(pg.body),
      date: bloggerDate('2026-10-01T09:00:00+02:00'),
      lastUpdated: bloggerDate('2026-10-01T09:00:00+02:00'),
      author: { name: 'Redacción', profileUrl: url('p/quienes-somos.html'), authorPhoto: { image: '' }, aboutMe: '' },
      labels: [],
      featuredImage: '',
      numberOfComments: 0,
      allowComments: false,
      showThreadedComments: false,
      snippets: { short: snippetText(pg.body, { length: 160 }), long: snippetText(pg.body, { length: 400 }) },
      comments: [],
    };
  });

  const featuredPick = posts.find((p) => p.section === 'Opinión') || posts[posts.length - 1];
  const popular = [posts[1], posts[0], posts[4], posts[6], posts[3], posts[8]].filter(Boolean);

  const blog = {
    title: SITE.title,
    url: url(''),
    homepageUrl: url(''),
    canonicalUrl: url(''),
    canonicalHomepageUrl: url(''),
    searchUrl: url('search'),
    blogId: SITE.blogId,
    encoding: 'UTF-8',
    languageDirection: 'ltr',
    locale: 'es',
    metaDescription: SITE.description,
    blogspotFaviconUrl: url('favicon.ico'),
    feedLinks: raw(`<link rel="alternate" type="application/atom+xml" title="${SITE.title} - Atom" href="${url('feeds/posts/default')}">\n<link rel="alternate" type="application/rss+xml" title="${SITE.title} - RSS" href="${url('feeds/posts/default?alt=rss')}">`),
  };

  const tickerHtml = ticker.length
    ? raw(`<ul>${ticker.map((t) => {
      const p = posts.find((x) => x.slug === t.slug);
      return p ? `<li><a href="${p.url}">${escapeHtml(t.text)}</a></li>` : '';
    }).join('')}</ul>`)
    : raw('');

  // ---- vistas ---------------------------------------------------------------------------
  const baseView = {
    isHomepage: false, isPost: false, isPage: false, isSingleItem: false, isMultipleItems: false, isSearch: false,
    isLabelSearch: false, isArchive: false, isError: false, isPreview: false, isLayoutMode: false, isMobile: false,
    title: SITE.title, description: '', featuredImage: '', search: { label: '', query: '' },
  };
  const view = (over) => ({ ...baseView, ...over, url: new Rich(over.url || url(''), { canonical: over.url || url('') }) });
  const pageType = (v) => (v.isPost ? 'item' : v.isPage ? 'static_page' : v.isError ? 'error_page' : v.isArchive ? 'archive' : 'index');

  /** @type {{ file: string, view: any, blog: { posts: any[], olderPageUrl?: string, newerPageUrl?: string, olderPageTitle?: string, newerPageTitle?: string }, ticker: 'curated'|'feed', currentPage?: string }[]} */
  const views = [];
  const home = posts.slice(0, SITE.postsOnHome);
  const older = posts.slice(SITE.postsOnHome);
  const olderUrl = older.length ? url(`search?updated-max=${encodeURIComponent(home[home.length - 1].date.iso8601)}&max-results=${SITE.postsOnHome}`) : '';
  views.push({ file: 'index.html', view: view({ isHomepage: true, isMultipleItems: true, description: SITE.description, url: url('') }), blog: { posts: home, olderPageUrl: olderUrl }, ticker: 'curated' });
  if (older.length) views.push({ file: 'search/older.html', view: view({ isMultipleItems: true, url: olderUrl }), blog: { posts: older, newerPageUrl: url('') }, ticker: 'feed' });
  posts.forEach((p, i) => {
    const newer = posts[i - 1];
    const olderP = posts[i + 1];
    views.push({
      file: rel(p.url.__str),
      view: view({ isPost: true, isSingleItem: true, title: p.title, description: p.snippets.short, featuredImage: p.featuredImage, url: p.url.__str, postId: p.id }),
      blog: { posts: [p], newerPageUrl: newer ? newer.url.__str : '', newerPageTitle: newer ? newer.title : '', olderPageUrl: olderP ? olderP.url.__str : '', olderPageTitle: olderP ? olderP.title : '' },
      ticker: 'feed',
    });
  });
  for (const l of allLabels) {
    views.push({
      file: `search/label/${l.name}.html`,
      view: view({ isMultipleItems: true, isSearch: true, isLabelSearch: true, title: l.name, search: { label: l.name, query: '' }, url: l.url }),
      blog: { posts: posts.filter((p) => p.labels.some((x) => x.name === l.name)) },
      ticker: 'feed',
    });
  }
  const q = SITE.searchSample;
  const match = (p) => `${p.title} ${p.body}`.toLowerCase().includes(q);
  views.push({ file: 'search.html', view: view({ isMultipleItems: true, isSearch: true, title: SITE.title, search: { label: '', query: q }, url: url(`search?q=${q}`) }), blog: { posts: posts.filter(match) }, ticker: 'feed' });
  views.push({ file: 'search/empty.html', view: view({ isMultipleItems: true, isSearch: true, title: SITE.title, search: { label: '', query: SITE.searchEmpty }, url: url(`search?q=${SITE.searchEmpty}`) }), blog: { posts: [] }, ticker: 'feed' });
  // Hemeroteca mensual, como /2026/10/ en Blogger.
  const months = new Map();
  for (const p of posts) {
    const key = rel(p.url.__str).split('/').slice(0, 2).join('/');
    months.set(key, [...(months.get(key) || []), p]);
  }
  for (const [key, list] of months) {
    const [yyyy, mm] = key.split('/');
    const label = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }).format(new Date(`${yyyy}-${mm}-15T12:00:00Z`));
    views.push({ file: `${key}/index.html`, view: view({ isMultipleItems: true, isArchive: true, title: label.charAt(0).toUpperCase() + label.slice(1), url: url(`${key}/`) }), blog: { posts: list }, ticker: 'feed' });
  }
  for (const pg of pages) {
    views.push({ file: `p/${pg.slug}.html`, view: view({ isPage: true, isSingleItem: true, title: pg.title, description: pg.snippets.short, url: pg.url.__str }), blog: { posts: [pg] }, ticker: 'feed', currentPage: pg.url.__str });
  }
  views.push({ file: '404.html', view: view({ isError: true, url: url('404.html') }), blog: { posts: [] }, ticker: 'feed' });

  /** Datos de cada widget para una vista. */
  function widgetData(v) {
    return ({ type, id, settings }) => {
      switch (type) {
        case 'Header': return { description: SITE.description, sourceUrl: '', image: '', imagePlacement: 'BEHIND', width: 0, height: 0 };
        case 'LinkList': {
          const links = Object.keys(settings).filter((k) => /^link-\d+$/.test(k)).sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
            // En Blogger "/search/label/X" es relativo a la raíz del blog; en el preview, a la base.
            .map((k) => ({ name: settings[`text-${k.slice(5)}`] || '', target: settings[k].startsWith('/') ? url(settings[k].slice(1)) : settings[k] }));
          return { links };
        }
        case 'HTML': {
          if (id === 'HTML1') return { content: v.ticker === 'curated' ? tickerHtml : raw('') };
          return { content: raw(settings.content || '') };
        }
        case 'Blog': return { ...v.blog };
        case 'FeaturedPost': return { posts: featuredPick ? [featuredPick] : [], post: featuredPick };
        case 'PopularPosts': return { posts: popular };
        case 'Label': return { labels: allLabels, display: 'LIST', showFreqNumbers: false };
        case 'Profile': return {
          team: false, displayname: `Redacción de ${SITE.title}`, userUrl: url('p/quienes-somos.html'),
          aboutme: `${SITE.title} es un periódico digital de demostración: noticias de cercanía, contadas con calma y contexto.`,
          location: 'Madrid', authorPhoto: { image: '' }, authors: [],
        };
        case 'PageList': return { links: [{ href: url(''), title: 'Portada', isCurrentPage: v.view.isHomepage }, ...pages.map((pg) => ({ href: pg.url.__str, title: pg.title, isCurrentPage: v.currentPage === pg.url.__str }))] };
        default: return {};
      }
    };
  }

  function globalsFor(v) {
    return {
      blog: { ...blog, pageType: pageType(v.view), pageTitle: v.view.isHomepage ? SITE.title : `${SITE.title}: ${v.view.title}`, pageName: v.view.isHomepage ? '' : v.view.title, searchLabel: v.view.search.label, searchQuery: v.view.search.query },
      view: v.view,
      messages: MESSAGES,
    };
  }

  return { posts, pages, labels: allLabels, views, widgetData, globalsFor, feed: () => feedJson({ posts, base, blog, sections }) };
}

const MESSAGES = new Proxy({
  readMore: 'Leer más', olderPosts: 'Entradas antiguas', newerPosts: 'Entradas más recientes', home: 'Inicio',
  postAComment: 'Publicar un comentario', comments: 'Comentarios', noResultsFound: 'No se ha encontrado ninguna entrada.',
}, { get: (t, k) => (typeof k === 'string' ? t[k] ?? k : undefined), has: () => true });

// ---- feed JSON con la forma exacta de /feeds/posts/default?alt=json ----------------------------

function feedJson({ posts, base, blog }) {
  const t = (v) => ({ $t: String(v) });
  const iso = (s) => s.replace(/(:\d\d)([+-]\d\d:\d\d)$/, '$1.000$2');
  return {
    version: '1.0',
    encoding: 'UTF-8',
    feed: {
      xmlns: 'http://www.w3.org/2005/Atom',
      'xmlns$openSearch': 'http://a9.com/-/spec/opensearchrss/1.0/',
      'xmlns$blogger': 'http://schemas.google.com/blogger/2008',
      'xmlns$georss': 'http://www.georss.org/georss',
      'xmlns$gd': 'http://schemas.google.com/g/2005',
      'xmlns$thr': 'http://purl.org/syndication/thread/1.0',
      id: t(`tag:blogger.com,1999:blog-${blog.blogId}`),
      updated: t(iso(posts[0]?.date.iso8601 || '2026-10-19T00:00:00+02:00')),
      category: [...new Set(posts.flatMap((p) => p.labels.map((l) => l.name)))].map((term) => ({ term })),
      title: { type: 'text', $t: blog.title },
      subtitle: { type: 'html', $t: SITE.description },
      link: [{ rel: 'alternate', type: 'text/html', href: base }],
      author: [{ name: t('Redacción'), email: t('noreply@blogger.com') }],
      generator: { version: '7.00', uri: 'http://www.blogger.com', $t: 'Blogger' },
      'openSearch$totalResults': t(posts.length),
      'openSearch$startIndex': t(1),
      'openSearch$itemsPerPage': t(25),
      entry: posts.map((p) => ({
        id: t(`tag:blogger.com,1999:blog-${blog.blogId}.post-${p.id}`),
        published: t(iso(p.date.iso8601)),
        updated: t(iso(p.lastUpdated.iso8601)),
        category: p.labels.map((l) => ({ scheme: 'http://www.blogger.com/atom/ns#', term: l.name })),
        title: { type: 'text', $t: p.title },
        content: { type: 'html', $t: p.body.__str },
        link: [
          { rel: 'replies', type: 'application/atom+xml', href: `${base}feeds/${p.id}/comments/default`, title: `${p.numberOfComments} comentarios` },
          { rel: 'replies', type: 'text/html', href: `${p.url}#comment-form`, title: `${p.numberOfComments} comentarios` },
          { rel: 'self', type: 'application/atom+xml', href: `${base}feeds/posts/default/${p.id}` },
          { rel: 'alternate', type: 'text/html', href: String(p.url), title: p.title },
        ],
        author: [{ name: t(p.author.name), uri: t(p.author.profileUrl), email: t('noreply@blogger.com'), gd$image: { rel: 'http://schemas.google.com/g/2005#thumbnail', width: '16', height: '16', src: 'https://img1.blogblog.com/img/b16-rounded.gif' } }],
        'media$thumbnail': { 'xmlns$media': 'http://search.yahoo.com/mrss/', url: new URL(`img/${p.slug}-w400.webp`, base).href, height: '72', width: '72' },
        'thr$total': t(p.numberOfComments),
      })),
    },
  };
}

// ---- includables por defecto de Blogger que el tema no redefine -------------------------------

const commentHtml = (c, postId, isReply = false) => `<li class="comment" id="c${c.id}"><div class="avatar-image-container"><img alt="" height="35" loading="lazy" src="https://resources.blogblog.com/img/blank.gif" width="35"></div><div class="comment-block"><div class="comment-header"><cite class="user"><a href="#" rel="nofollow">${escapeHtml(c.author)}</a></cite><span class="icon user"></span><span class="datetime secondary-text"><a href="#c${c.id}" rel="nofollow">${escapeHtml(c.date)}</a></span></div><p class="comment-content">${escapeHtml(c.body)}</p><span class="comment-actions secondary-text">${isReply ? '' : `<a class="comment-reply" data-comment-id="${c.id}" target="_self">Responder</a>`}<span class="item-control blog-admin pid-${postId}"><a href="#" target="_self">Eliminar</a></span></span></div>${!isReply ? `<div class="comment-replies">${c.replies?.length ? `<div class="comment-thread inline-thread" id="c${c.id}-rt"><span class="thread-toggle thread-expanded"><span class="thread-arrow"></span><span class="thread-count"><a target="_self">Respuestas</a></span></span><ol class="thread-chrome thread-expanded" id="c${c.id}-ra"><div>${c.replies.map((r) => commentHtml(r, postId, true)).join('')}</div><div class="continue" id="c${c.id}-continue"><a class="comment-reply" data-comment-id="${c.id}" target="_self">Responder</a></div></ol></div>` : ''}</div><div class="comment-replybox-single" id="c${c.id}-ce"></div>` : ''}</li>`;

function threadedComments({ data: post }) {
  if (!post) return '';
  return `${NATIVE_COMMENTS}${threadedCommentsHtml(post)}`;
}

function threadedCommentsHtml(post) {
  const list = post.comments || [];
  return `<section class="comments threaded" data-embed="true" data-num-comments="${post.numberOfComments}" id="comments"><a name="comments"></a><h3 class="title">Comentarios</h3><div class="comments-content"><div id="comment-holder"><div class="comment-thread toplevel-thread"><ol id="top-ra">${list.map((c) => commentHtml(c, post.id)).join('')}</ol><div class="continue" id="top-continue"><a class="comment-reply" target="_self">Añadir comentario</a></div><div class="comment-replybox-thread" id="top-ce"></div><div class="loadmore hidden" data-post-id="${post.id}"><a target="_self">Cargar más…</a></div></div></div></div><div class="comment-footer"><div class="comment-form"><a name="comment-form"></a><h4 id="comment-post-message">Publicar un comentario</h4><p></p><iframe allowtransparency="true" class="blogger-iframe-colorize blogger-comment-from-post" frameborder="0" height="410" id="comment-editor" name="comment-editor" src="about:blank" title="Formulario de comentarios" width="100%"></iframe></div></div></section>`;
}

export const DEFAULT_INCLUDABLES = {
  'Blog/threadedComments': threadedComments,
  'Blog/comments': threadedComments,
  'Attribution/main': () => '<div class="widget-content attribution">Con la tecnología de <a href="https://www.blogger.com" rel="nofollow">Blogger</a>.</div>',
  '*/main': ({ widget }) => `${widget.data.title ? `<h3 class="title">${escapeHtml(widget.data.title)}</h3>` : ''}<div class="widget-content">${widget.data.content?.__str ?? ''}</div>`,
};
