# Horizonte Diario · tema de periódico para Blogger

Tema completo para convertir un blog de Blogger en un **periódico digital**: portada con noticia destacada, franja de «Última hora», bloques por sección, artículos cómodos de leer (sumario, barra de progreso, tiempo de lectura, compartir), modo oscuro y buen rendimiento en el móvil.

Solo hay que importar **un archivo: `theme.xml`**. Esta guía explica cómo instalarlo y configurarlo paso a paso.

---

## Índice

1. [Qué incluye](#1-qué-incluye)
2. [Antes de empezar](#2-antes-de-empezar)
3. [Instalación](#3-instalación)
4. [Ajustes de Blogger recomendados](#4-ajustes-de-blogger-recomendados)
5. [Secciones (etiquetas)](#5-secciones-etiquetas)
6. [Gadgets: qué hace cada uno](#6-gadgets-qué-hace-cada-uno)
7. [Cómo publicar una noticia](#7-cómo-publicar-una-noticia)
8. [Colores, tipografía y logotipo](#8-colores-tipografía-y-logotipo)
9. [SEO y rendimiento](#9-seo-y-rendimiento)
10. [Compatibilidad y limitaciones](#10-compatibilidad-y-limitaciones)
11. [Solución de problemas](#11-solución-de-problemas)
12. [Para desarrolladores](#12-para-desarrolladores)

---

## 1. Qué incluye

| Página | Qué se ve |
|---|---|
| **Portada** | Noticia principal + 2 secundarias, «Últimas noticias» con botón «Más noticias» (carga sin recargar la página), bloque «A fondo» elegido por la redacción y un bloque por sección |
| **Noticia** | Antetítulo de sección, titular, autor, fecha y tiempo de lectura, foto de portada, sumario automático, barra de progreso, compartir (WhatsApp, X, Facebook, copiar enlace), etiquetas, «Más de la sección» y comentarios de Blogger |
| **Sección / etiqueta** | Cabecera con el nombre de la sección en su color y la lista de noticias |
| **Búsqueda** | Panel de búsqueda con resultados al escribir y página de resultados |
| **Páginas** | Quiénes somos, Contacto, Aviso legal… (páginas estáticas de Blogger) |
| **404** | Mensaje claro, buscador y últimas noticias |

En todas: cabecera con la fecha del día, barra de secciones fija al hacer scroll (en el móvil, fila deslizable y menú), «Última hora», barra lateral (lo más leído, boletín y temas), pie con secciones, redes y aviso legal, y **modo oscuro** (automático según el sistema y con botón).

---

## 2. Antes de empezar

1. **Haz una copia de seguridad del tema actual.** En Blogger: **Tema** → flecha ▾ junto a **Personalizar** → **Crear copia de seguridad** → **Descargar**. Si algo no te convence, podrás volver atrás en un minuto con **Restaurar**.
2. **Recomendado: pruébalo primero en un blog de prueba privado.** Crea un blog nuevo, ponlo en **Configuración → Permisos → Visible para los lectores: Privado (solo autores)** e importa allí el tema. Así ves widgets, comentarios y móvil sin que nadie lo vea.
3. Ten a mano el archivo **`theme.xml`** de esta carpeta.

---

## 3. Instalación

1. Entra en Blogger y abre **Tema**.
2. Pulsa la flecha ▾ junto a **Personalizar** y elige **Restaurar**.
3. **Subir** → selecciona `theme.xml`.
4. Si Blogger pregunta qué hacer con los gadgets del tema anterior, en un blog nuevo elige **Eliminar gadgets** (instalación limpia). En un blog con gadgets que quieras conservar, elige **Mantener gadgets** y después ordénalos en **Diseño**.
5. Abre el blog: ya debería verse con el diseño nuevo. Sigue con los ajustes del apartado 4.

> Si Blogger muestra un error al subir el archivo, no lo edites a mano: escríbenos con el texto del error (ver [Solución de problemas](#11-solución-de-problemas)).

---

## 4. Ajustes de Blogger recomendados

Los nombres de los menús pueden variar un poco según la versión de Blogger.

| Dónde | Ajuste | Por qué |
|---|---|---|
| **Configuración → Feed del sitio** | **Permitir feed del blog: Completo** | **Imprescindible.** «Última hora», los bloques de la portada, «Más noticias», la búsqueda al escribir, las relacionadas y el tiempo de lectura leen el feed. Con «Ninguno» esas partes no aparecen. |
| **Configuración → Entradas** | **Número máximo de entradas en la página principal: 9** | 1 principal + 2 secundarias + 6 en «Últimas noticias». El resto se carga con «Más noticias». |
| **Configuración → Comentarios** | **Ubicación de los comentarios: Insertado** | Muestra los comentarios con respuestas debajo de la noticia, con el estilo del tema. |
| **Configuración → Formato** | **Zona horaria: (GMT+01:00) Madrid** · Idioma: Español | Las fechas se calculan en hora peninsular. |
| **Configuración → Metaetiquetas** | **Habilitar descripción de búsqueda: Sí** y escribe la descripción del blog | Se usa en Google y al compartir en redes. |
| **Configuración → HTTPS** | **Redireccionamiento HTTPS: Sí** | Seguridad y SEO. |
| **Configuración → Rastreadores e indexación** | Deja **desactivadas** las «etiquetas de encabezado de robots personalizadas» | El tema ya indica a Google qué indexar: portada, noticias, páginas y **secciones** sí; búsquedas, etiquetas de tema y hemeroteca no (evita contenido duplicado). |

---

## 5. Secciones (etiquetas)

En Blogger, las secciones del periódico son **etiquetas**. El tema trae seis, cada una con su color:

**Actualidad · Economía · Cultura · Tecnología · Deportes · Opinión**

Reglas sencillas:

- Cada noticia lleva **una etiqueta de sección** (escrita exactamente así, con tildes) y, si quieres, **otras etiquetas de tema** (por ejemplo «Movilidad», «Barrios»).
- Blogger ordena las etiquetas alfabéticamente; no pasa nada: el tema reconoce cuál de ellas es la sección.
- La dirección de cada sección es `https://TU-BLOG/search/label/Economía` (Blogger la crea sola).

### Cambiar, añadir o quitar secciones

Una sección aparece en cuatro sitios. Para añadir, por ejemplo, «Internacional»:

1. **Menú**: Diseño → gadget **Secciones** (barra fija) → añade el enlace *Internacional* → `/search/label/Internacional`. Repite en el gadget **Secciones** del pie si quieres.
2. **Portada**: Diseño → **Portada: bloques por sección** → **Añadir un gadget** → **HTML/JavaScript** → **Título: Internacional** (el nombre exacto de la etiqueta) y contenido vacío. El orden de los bloques se cambia arrastrándolos.
3. **Reconocimiento de la sección** (para el antetítulo y el color): Tema → **Editar HTML** → busca `{"Actualidad", "Economía", "Cultura", "Tecnología", "Deportes", "Opinión"}` y añade `"Internacional"` en **todas** las apariciones (usa Ctrl+F; están en la misma forma). Si no lo haces, la noticia mostrará como antetítulo su primera etiqueta.
4. **Color** (opcional): sin color propio, la sección usa el azul de la marca. Para darle uno, pídenoslo o añade en **Tema → Personalizar → Avanzado → Añadir CSS** la línea `[data-section="Internacional" i] { --sec: #1B6E8A; }` (con el color que quieras).

Para **renombrar** una sección, cambia el nombre de la etiqueta en las entradas (Entradas → seleccionar → Etiquetas) y después en los mismos cuatro sitios.

---

## 6. Gadgets: qué hace cada uno

En **Diseño** verás las zonas del tema con estos gadgets:

| Zona | Gadget | Qué configurar |
|---|---|---|
| Cabecera | **Horizonte Diario (cabecera)** | Título y descripción del periódico. Para usar un **logotipo**: sube la imagen y elige *En lugar del título y la descripción*. |
| Barra fija | **Secciones** | Los enlaces del menú. «Portada» siempre aparece primero. |
| Última hora | **Última hora** | **Vacío = automático** (las últimas entradas). Para titulares escritos a mano, pon en el contenido una lista: `<ul><li><a href="URL">Titular</a></li>…</ul>`. El título del gadget es la etiqueta roja («Última hora», «En directo»…). |
| Entradas | **Entradas del blog** | No se mueve ni se borra. |
| Portada: A fondo | **A fondo** | Elige la noticia que quieres destacar (reportaje, análisis). Solo se ve en la portada. |
| Portada: bloques por sección | 6 gadgets **HTML** | El **título** de cada uno es la etiqueta de la sección. Se rellenan solos sin repetir noticias que ya están en la portada. |
| Barra lateral | **Lo más leído** | Las 5 entradas más vistas (estadísticas de Blogger). Puedes elegir el periodo (semana, mes, siempre). |
| Barra lateral | **Recibe el boletín** | El formulario incluido es de **demostración** (no envía nada). Sustituye el contenido por el código de tu servicio (Mailchimp, Brevo, Substack, MailerLite…). |
| Barra lateral | **Temas** | La lista de etiquetas. Puedes mostrar solo algunas. |
| Pie | **Quiénes somos** | Usa el perfil de Blogger: el texto «Sobre mí» de tu perfil aparece aquí. |
| Pie | **Secciones**, **Síguenos**, **Información**, **Aviso legal** | Enlaces del pie. En **Síguenos**, el **nombre** de cada enlace elige el icono: `X`, `Facebook`, `Instagram`, `YouTube`, `WhatsApp`, `RSS`. **Información** lista las páginas estáticas (crea en *Páginas*: Quiénes somos, Contacto, Aviso legal, Política de privacidad). |

---

## 7. Cómo publicar una noticia

1. **Título**: claro y directo (idealmente menos de 70 caracteres).
2. **Primer párrafo** (entradilla): resume la noticia. Es el texto que se ve en las tarjetas.
3. **Foto principal**: súbela con el botón de imagen de Blogger **justo después del primer párrafo** y añade el pie («Foto: Autor / Agencia»).
   - La primera imagen de la entrada es la **portada** de la noticia y la imagen que sale al **compartir**. El tema la muestra arriba a todo lo ancho y la quita del texto para que no salga dos veces.
   - Súbela **a Blogger** (no la enlaces desde otra web): así el tema la sirve en el tamaño justo para cada pantalla. Tamaño recomendado: 1600 × 900 px.
4. **Subtítulos**: usa **Encabezado** (y **Subencabezado** para niveles inferiores). Con 3 o más, el tema crea el **sumario** «En este artículo». Para no mostrarlo en una noticia concreta, escribe `<!--notoc-->` en la vista HTML.
5. **Etiquetas**: una sección + los temas que quieras.
6. **Descripción de búsqueda** (panel derecho): 1–2 frases. Se usa en Google y al compartir.
7. Publica. La noticia aparece arriba en la portada y en su sección.

---

## 8. Colores, tipografía y logotipo

**Tema → Personalizar → Avanzado** muestra estos grupos:

- **Colores**: fondo, textos, líneas, azul de la marca (enlaces), «sol» (destacados), rojo de «Última hora», foco y pie.
- **Colores del modo oscuro**: los mismos para el modo oscuro.
- **Colores de las secciones**: un color por sección, con su versión oscura.
- **Tipografía**: la de los titulares (Newsreader) y la del texto (Schibsted Grotesk).

Consejos: cambia pocos colores a la vez y comprueba que el texto se sigue leyendo bien (contraste). Los colores de serie cumplen las pautas de accesibilidad WCAG AA.

**Logotipo**: Diseño → gadget de la cabecera → imagen (ver apartado 6). **Favicon**: Configuración → Básico → Favicon.

---

## 9. SEO y rendimiento

Ya viene hecho:

- **Imagen al compartir la portada** (opcional): Tema → Editar HTML → busca `IMAGEN PARA COMPARTIR` y sigue las instrucciones del comentario (una imagen de 1200 × 630 px subida a Blogger). Las noticias usan su propia foto automáticamente.
- Título y descripción por página, **URL canónica**, **Open Graph** y **X/Twitter Cards** (imagen grande al compartir).
- Datos estructurados **NewsArticle** y **BreadcrumbList** en cada noticia, y **NewsMediaOrganization** + buscador del sitio en la portada.
- Las **secciones** (Actualidad, Economía…) se indexan como páginas de entrada, con descripción propia («Últimas noticias de Economía en …»). La búsqueda, las etiquetas de tema, la hemeroteca y el 404 se marcan `noindex, follow` (evita contenido duplicado). Las noticias admiten vista previa grande de imagen (`max-image-preview:large`, útil para Google Discover).
- Imágenes con tamaño justo (`srcset`), carga diferida fuera de pantalla y prioridad alta para la foto principal.
- CSS en línea, fuentes sin bloquear la carga, JavaScript propio sin librerías (≈ 23 KB) que no frena el dibujado.
- Accesible con teclado y lector de pantalla: enlace «Saltar al contenido», foco visible, menús con Esc, respeta «reducir movimiento».

---

## 10. Compatibilidad y limitaciones

- **Navegadores**: Chrome, Edge, Firefox y Samsung Internet recientes, y Safari/iPhone desde iOS 15. Sin JavaScript todo el contenido se lee y la paginación clásica funciona.
- **Comentarios**: son los nativos de Blogger. El formulario es un recuadro de Blogger (iframe) que no admite estilos propios y se ve en claro también en modo oscuro. Su marcado lo genera Blogger y no se puede modificar.
- **Feed**: Google guarda en caché el feed unos minutos; una noticia recién publicada puede tardar un poco en salir en «Última hora» o en los bloques (en la lista principal sale al momento).
- **Lo más leído** depende de las estadísticas de Blogger (necesita visitas reales).
- **Fuentes**: Newsreader y Schibsted Grotesk se cargan desde Google Fonts (Blogger no permite alojar archivos de fuentes); como el blog ya está alojado en Google, no añade un tercero nuevo a efectos del RGPD.

---

## 11. Solución de problemas

| Problema | Solución |
|---|---|
| Blogger no acepta el archivo al restaurar | Asegúrate de subir `theme.xml` sin modificar. Si lo has editado, valida el XML (ver apartado 12) o escríbenos con el mensaje exacto. |
| «Última hora» o los bloques de la portada salen vacíos | Revisa **Configuración → Feed del sitio → Completo** y que haya entradas publicadas con esas etiquetas. |
| Una noticia no muestra su sección o sale sin color | La etiqueta no coincide exactamente (tildes, mayúsculas) con una de las secciones del apartado 5. |
| La foto principal sale borrosa o pesa mucho | Súbela a Blogger (no la enlaces desde otra web) en al menos 1600 px de ancho. |
| La foto sale dos veces | Ponla al principio (antes o justo después del primer párrafo); si está más abajo, el tema la respeta en su sitio. |
| No aparece el sumario | Hacen falta 3 o más subtítulos (Encabezado/Subencabezado) y no tener `<!--notoc-->`. |
| Quiero volver al tema anterior | Tema → ▾ → **Restaurar** → sube la copia de seguridad del paso 2. |

---

## 12. Para desarrolladores

`theme.xml` es un archivo **generado**: no se edita a mano. El código fuente está en `src/` y se compila con Node 20+.

```
src/theme/theme.src.xml   esqueleto: head, secciones, widgets (incluye parciales)
src/theme/head/           SEO, fuentes, CSS del editor de Diseño
src/theme/widgets/        lógica de Blog1 (despacho por página, JSON-LD, comentarios)
src/theme/parts/          presentación (cabecera, tarjetas, artículo, pie…)
src/styles/, tokens.json  CSS y tokens de diseño (secciones, colores, tipografía)
src/js/                   JavaScript (módulos ES → esbuild → IIFE en línea)
tools/                    build, validador, preview, servidor y pruebas E2E
content/                  12 noticias de demostración
```

| Orden | Qué hace |
|---|---|
| `npm run build` | Genera `theme/theme.xml` y lo valida (XML bien formado + reglas de Blogger). |
| `npm run validate [archivo.xml]` | Valida cualquier tema de Blogger, también uno exportado. |
| `npm run preview` | Build + preview estático en `preview/` (55 páginas) renderizando el propio `theme.xml` con datos de prueba. |
| `npm run dev` | Sirve el preview en <http://localhost:4173/> con las rutas de Blogger (`/2026/10/noticia.html`, `/search/label/…`, `/search?q=…`). |
| `npm test` · `npm run lint` · `npm run smoke` | Pruebas unitarias, ESLint + Stylelint + html-validate, y prueba E2E en Edge/Chrome sin interfaz. |

Marcadores del fuente: `<!-- @include ruta -->` (parcial), `<!-- @inject:skin|css|js|js-head -->` (contenido generado), `{{SECTIONS}}` y `{{SECTION_OF:post}}` (lista de secciones desde `src/tokens.json`). Las secciones se cambian en `src/tokens.json` y el build actualiza tema, colores y JS a la vez.
