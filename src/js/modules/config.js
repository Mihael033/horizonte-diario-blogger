// Configuración que inyecta el build (esbuild define) desde src/tokens.json.
// En los tests (Node, sin build) se usan los valores por defecto.

/** Etiquetas que son secciones, en orden. */
export const SECTIONS = typeof __HD_SECTIONS__ !== 'undefined' ? __HD_SECTIONS__ : ['Actualidad', 'Economía', 'Cultura', 'Tecnología', 'Deportes', 'Opinión'];

/** Color de fondo de cada tema (para <meta name="theme-color">). */
export const THEME_COLORS = typeof __HD_THEME_COLORS__ !== 'undefined' ? __HD_THEME_COLORS__ : { light: '#FFFFFF', dark: '#0B1527' };

export const LOCALE = 'es-ES';
export const TIME_ZONE = 'Europe/Madrid';
/** Anchos de imagen que se piden a Blogger (srcset). */
export const IMAGE_WIDTHS = [400, 800, 1200, 1600];
/** Palabras por minuto para el tiempo de lectura (lectura en pantalla en español). */
export const WORDS_PER_MINUTE = 200;
export const STORAGE_THEME = 'hd-theme';
