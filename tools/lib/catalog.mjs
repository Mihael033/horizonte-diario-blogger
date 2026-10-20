// Catálogo de lo que admite el motor de temas de Blogger (layouts v3, widgets version 2).
// Confianza: 'ok' = documentado o presente en los temas oficiales (Contempo, Soho, Notable…);
//            '?'  = usado en temas de terceros o deducido; hay que confirmarlo en el blog de prueba.
// El validador marca como aviso lo desconocido y lista aparte lo que tiene '?'.

export const NAMESPACES = {
  '': 'http://www.w3.org/1999/xhtml',
  b: 'http://www.google.com/2005/gml/b',
  data: 'http://www.google.com/2005/gml/data',
  expr: 'http://www.google.com/2005/gml/expr',
};

/** Elementos b: y sus atributos (requeridos / opcionales). */
export const B_ELEMENTS = {
  'b:skin': { opt: ['version'] },
  'b:template-skin': { opt: [] },
  'b:section': { req: ['id'], opt: ['class', 'maxwidgets', 'showaddelement', 'growth', 'name', 'preferred', 'cond'] },
  'b:widget': { req: ['id', 'type'], opt: ['title', 'locked', 'visible', 'version', 'mobile', 'pageType', 'cond'] },
  'b:widget-settings': { opt: [] },
  'b:widget-setting': { req: ['name'], opt: [] },
  'b:includable': { req: ['id'], opt: ['var'] },
  'b:include': { req: ['name'], opt: ['data', 'cond'] },
  'b:if': { req: ['cond'], opt: [] },
  'b:elseif': { req: ['cond'], opt: [] },
  'b:else': { opt: [] },
  'b:loop': { req: ['values', 'var'], opt: ['index', 'reverse'] },
  'b:with': { req: ['var', 'value'], opt: [] },
  'b:switch': { req: ['var'], opt: [] },
  'b:case': { req: ['value'], opt: [] },
  'b:default': { opt: [] },
  'b:attr': { req: ['name'], opt: ['value', 'expr:value', 'cond'] },
  'b:class': { opt: ['name', 'expr:name', 'cond'] },
  'b:eval': { req: ['expr'], opt: [] },
  'b:comment': { opt: [] },
  'b:tag': { opt: ['name', 'expr:name', 'cond'] },
  'b:message': { req: ['name'], opt: [] },
  'b:param': { req: ['value'], opt: ['name', 'expr:value'] },
  'b:defaultmarkups': { opt: [] },
  'b:defaultmarkup': { req: ['type'], opt: [] },
};

/** Atributos b: admitidos en <html> y otros elementos HTML. */
export const B_HTML_ATTRS = new Set(['b:css', 'b:js', 'b:version', 'b:layoutsVersion', 'b:defaultwidgetversion', 'b:responsive', 'b:templateVersion', 'b:templateUrl']);

/** Tipos de widget y ajustes conocidos (b:widget-setting). Un patrón /…/ cubre los numerados. */
export const WIDGET_TYPES = {
  Blog: { settings: [] },
  Header: { settings: ['displayUrl', 'displayHeight', 'sectionWidth', 'useImage', 'shrinkToFit', 'imagePlacement', 'displayWidth'] },
  HTML: { settings: ['content'] },
  LinkList: { settings: ['sorting', /^(text|link)-\d+$/] },
  Label: { settings: ['sorting', 'display', 'selectedLabelsList', 'showType', 'showFreqNumbers'] },
  PopularPosts: { settings: ['numItemsToShow', 'showThumbnails', 'showSnippets', 'timeRange'] },
  FeaturedPost: { settings: ['showSnippet', 'showPostTitle', 'showFirstImage', 'useMostRecentPost', 'postId'] },
  Profile: { settings: ['showaboutme', 'showlocation'] },
  PageList: { settings: ['pagesToShow', 'homeTitle'] },
  Attribution: { settings: ['copyright'] },
  BlogArchive: { settings: [] },
  BlogSearch: { settings: [] },
  ContactForm: { settings: [] },
  Image: { settings: [] },
  Text: { settings: [] },
  Feed: { settings: [] },
  Subscribe: { settings: [] },
  Followers: { settings: [] },
  ReportAbuse: { settings: [] },
  Stats: { settings: [] },
  Translate: { settings: [] },
  Navbar: { settings: [] },
  BlogList: { settings: [] },
  TextList: { settings: [] },
  Wikipedia: { settings: [] },
  AdSense: { settings: [] },
};

/** Includables que Blogger da por defecto (widgets version 2) y que se pueden llamar sin definirlos. */
export const DEFAULT_INCLUDABLES = {
  '*': ['main', 'content', 'widget-title', 'title', 'quickedit', 'footer', 'super.main'],
  Blog: ['post', 'postCommentsAndAd', 'comments', 'threadedComments', 'commentForm', 'commentPicker', 'commentList', 'commentItem', 'commentBlock', 'commentAuthorAvatar', 'commentsLink', 'commentsLinkIframe', 'commentsTitle', 'iframeComments', 'threadedCommentForm', 'threadedCommentJs', 'addComments', 'aboutPostAuthor', 'postShareButtons', 'sharingButtons', 'sharingButton', 'sharingButtonContent', 'sharingPlatformIcon', 'platformShare', 'linkShare', 'otherSharingButton', 'blogThisShare', 'emailPostIcon', 'facebookShare', 'postTitle', 'postBody', 'postBodySnippet', 'postHeader', 'postFooter', 'postMeta', 'postLabels', 'postTimestamp', 'postAuthor', 'postLocation', 'postJumpLink', 'postReactions', 'postPagination', 'blogPager', 'nextPageLink', 'previousPageLink', 'homePageLink', 'feedLinks', 'feedLinksBody', 'status-message', 'backlinks', 'backlinkDeleteIcon', 'inlineAd', 'defaultAdUnit', 'postMetadataJSON', 'postMetadataJSONImage', 'postMetadataJSONPublisher', 'noContentPlaceholder', 'snippetedPosts', 'snippetedPostContent', 'snippetedPostTitle', 'snippetedPostThumbnail', 'snippetedPostByline', 'bylineByName', 'bylineRegion', 'headerByline', 'footerBylines'],
};

// ---- tipos de datos -------------------------------------------------------------------------
// Cada tipo: campo → 'ok' | '?' | { t: 'tipo', c: 'ok'|'?' } | { list: 'tipo', c } ; '*' = acepta cualquiera.

const STR_MODS = { escaped: 'ok', jsEscaped: 'ok', jsonEscaped: '?', canonical: 'ok', isResizable: 'ok', size: '?', length: '?', empty: '?', iso8601: 'ok' };
const LIST_MODS = { size: '?', length: '?', empty: 'ok', first: '?', last: '?' };

export const TYPES = {
  string: STR_MODS,
  number: {},
  boolean: {},
  any: { '*': '?' },
  url: { ...STR_MODS },
  date: { ...STR_MODS, iso8601: 'ok' },
  image: { ...STR_MODS, isResizable: 'ok' },
  blog: {
    title: 'ok', pageType: 'ok', url: { t: 'url', c: 'ok' }, homepageUrl: { t: 'url', c: 'ok' }, searchUrl: { t: 'url', c: 'ok' },
    canonicalUrl: { t: 'url', c: 'ok' }, canonicalHomepageUrl: { t: 'url', c: 'ok' }, pageTitle: 'ok', pageName: 'ok', encoding: 'ok',
    languageDirection: 'ok', feedLinks: 'ok', searchLabel: 'ok', searchQuery: 'ok', blogId: 'ok', metaDescription: 'ok',
    postImageUrl: '?', postImageThumbnailUrl: '?', blogspotFaviconUrl: '?', locale: '?', localeUnderscoreDelimited: '?',
    isMobile: '?', isMobileRequest: '?', analyticsAccountNumber: 'ok', adultContent: '?', dateHeader: '?',
  },
  view: {
    isHomepage: 'ok', isPost: 'ok', isPage: 'ok', isSingleItem: 'ok', isMultipleItems: 'ok', isSearch: 'ok', isLabelSearch: 'ok',
    isArchive: 'ok', isError: 'ok', isPreview: 'ok', isLayoutMode: 'ok', isMobile: '?', title: 'ok', description: 'ok',
    url: { t: 'url', c: 'ok' }, featuredImage: { t: 'image', c: 'ok' }, postId: '?', pageId: '?',
    search: { t: 'viewSearch', c: 'ok' }, archive: { t: 'any', c: '?' },
  },
  viewSearch: { label: 'ok', query: 'ok', resultsMessage: '?' },
  post: {
    id: 'ok', title: 'ok', url: { t: 'url', c: 'ok' }, link: 'ok', body: 'ok', date: { t: 'date', c: 'ok' }, lastUpdated: { t: 'date', c: '?' },
    timestamp: '?', dateHeader: 'ok', author: { t: 'author', c: 'ok' }, labels: { list: 'label', c: 'ok' },
    featuredImage: { t: 'image', c: 'ok' }, firstImageUrl: { t: 'image', c: 'ok' }, thumbnailUrl: { t: 'image', c: 'ok' },
    numberOfComments: 'ok', allowComments: 'ok', allowNewComments: 'ok', showThreadedComments: 'ok', commentsUrl: 'ok',
    snippets: { t: 'snippets', c: '?' }, snippet: '?', hasJumpLink: 'ok', jumpText: 'ok', location: '?', sharePostUrl: '?',
    commentSource: '?', commentFormIframeSrc: '?', comments: { list: 'any', c: 'ok' },
  },
  snippets: { short: '?', long: '?' },
  author: { name: 'ok', profileUrl: 'ok', authorPhoto: { t: 'authorPhoto', c: 'ok' }, aboutMe: '?' },
  authorPhoto: { image: { t: 'image', c: 'ok' }, width: '?', height: '?' },
  label: { name: 'ok', url: { t: 'url', c: 'ok' }, count: 'ok', isLast: '?' },
  linkListLink: { name: 'ok', target: 'ok' },
  pageListLink: { href: 'ok', title: 'ok', isCurrentPage: 'ok' },
  profileAuthor: { displayname: 'ok', userUrl: 'ok', authorPhoto: { t: 'authorPhoto', c: 'ok' } },
  messages: { '*': 'ok' },
};

/** Datos de cada tipo de widget (lo que hay en data:… dentro de sus includables). */
export const WIDGET_DATA = {
  '*': { title: 'ok', widget: { t: 'any', c: '?' } },
  Blog: { posts: { list: 'post', c: 'ok' }, olderPageUrl: 'ok', newerPageUrl: 'ok', olderPageTitle: 'ok', newerPageTitle: 'ok' },
  Header: { description: 'ok', sourceUrl: '?', imagePlacement: '?', image: '?', width: '?', height: '?', useImage: '?' },
  HTML: { content: 'ok' },
  LinkList: { links: { list: 'linkListLink', c: 'ok' } },
  Label: { labels: { list: 'label', c: 'ok' }, display: 'ok', showFreqNumbers: '?' },
  PopularPosts: { posts: { list: 'post', c: 'ok' } },
  FeaturedPost: { posts: { list: 'post', c: '?' }, post: { t: 'post', c: '?' } },
  Profile: { team: 'ok', authors: { list: 'profileAuthor', c: 'ok' }, displayname: 'ok', userUrl: 'ok', aboutme: 'ok', location: 'ok', authorPhoto: { t: 'authorPhoto', c: 'ok' } },
  PageList: { links: { list: 'pageListLink', c: 'ok' } },
  Attribution: { copyright: '?' },
};

export const GLOBAL_DATA = {
  blog: { t: 'blog', c: 'ok' },
  view: { t: 'view', c: 'ok' },
  messages: { t: 'messages', c: 'ok' },
  skin: { t: 'any', c: '?' },
};

const norm = (spec) => (typeof spec === 'string' ? { t: 'string', c: spec } : spec);

/** Tipo "datos del widget X" (lo que ve el includable main con var='this'). */
export function widgetTypeName(type) {
  const name = `widget:${type}`;
  if (!TYPES[name]) TYPES[name] = WIDGET_DATA[type] ? { ...WIDGET_DATA['*'], ...WIDGET_DATA[type] } : { '*': '?' };
  return name;
}

/**
 * Resuelve una ruta (segmentos tras el primero) sobre un tipo.
 * @returns {{ status: 'ok'|'?'|'unknown', at?: string, type?: string, list?: string }}
 */
export function resolveFields(startType, segs, { list = false } = {}) {
  let type = startType;
  let isList = list;
  let status = 'ok';
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (isList) {
      const c = LIST_MODS[seg];
      if (!c) return { status: 'unknown', at: seg };
      if (c === '?') status = '?';
      if (seg === 'first' || seg === 'last') { isList = false; continue; }
      return { status, type: 'any' };
    }
    const fields = TYPES[type] || TYPES.any;
    let spec = fields[seg];
    if (spec === undefined && fields['*']) spec = fields['*'];
    if (spec === undefined && type !== 'string' && STR_MODS[seg] && i === segs.length - 1) spec = STR_MODS[seg];
    if (spec === undefined) return type === 'any' ? { status: '?', type: 'any' } : { status: 'unknown', at: seg };
    const s = norm(spec);
    if (s.c === '?') status = '?';
    if (s.list) { type = s.list; isList = true; } else { type = s.t || 'any'; }
  }
  return { status, type, list: isList };
}
