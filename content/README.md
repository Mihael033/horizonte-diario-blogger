# Contenidos de muestra · Horizonte Diario

Los doce artículos, los autores y todas las declaraciones son ficticios. Las fotografías de archivo ilustran los temas; no documentan los hechos narrados ni representan a los protagonistas. El avatar de Elena Arce es un monograma propio, no el retrato de una persona real. Las frases de `ticker.json` remiten a estas mismas historias de demostración.

## Archivos y contrato de datos

- `posts.json`: array UTF-8 con los doce artículos y su cuerpo HTML.
- `ticker.json`: seis entradas con `text` y `slug`, que coincide con un artículo.
- `01-*.md` a `12-*.md`: un documento por artículo con metadatos y HTML para el editor del Blogger.
- `img/<slug>.jpg`: doce fotografías temáticas locales de 1600 × 900 píxeles.
- `img/autores/elena-arce.svg`: monograma de la columnista ficticia.

La distribución es Actualidad: 3; Economía, Cultura, Tecnología y Deportes: 2 cada una; Opinión: 1. Hay un artículo `featured` y dos `secondary`. Todas las fechas están entre el 12 y el 19 de octubre de 2026 con desplazamiento `+02:00`, correspondiente a Europe/Madrid en esas fechas. `date` es la fuente para formatear las fechas de la interfaz en español de España. `readingMinutes` se estima a partir del texto a 200 palabras por minuto, redondeando hacia arriba.

Cada artículo incorpora `id`, `slug`, `title`, `subtitle`, `kicker`, `excerpt`, `section`, `tags`, `author`, `date`, `readingMinutes`, `featured`, `secondary`, `isFictional`, `image` y `bodyHtml`. `section` es la etiqueta principal de navegación; `tags` contiene etiquetas complementarias. `author` incluye `name` y `role`, y un `avatar` en la columna de opinión. Cada cuerpo empieza por el primer párrafo real del artículo y contiene cinco párrafos, cuatro encabezados `h2`, una cita con atribución ficticia y una lista. El aviso de demostración y los créditos completos, con enlaces al original y a la licencia, van en un `aside` final para que no abran los snippets de Blogger. No contiene estilos en línea ni clases.

Las rutas `image.src` y `author.avatar` son relativas a las páginas generadas en `preview/`. El generador debe resolverlas desde esa carpeta o reescribirlas al copiar los recursos. No son URL de producción para Blogger. `image.sourceUrl` enlaza la ficha de la foto; `image.licenseUrl`, la licencia; `image.pexelsId` identifica el original y permite reconstruir su URL de descarga. `image.credit` identifica al fotógrafo y el carácter de archivo.

## Preparar una entrada en Blogger

1. Abre el `.md` del artículo y crea una entrada nueva. Copia el título en el campo de título de Blogger.
2. Usa `section` como etiqueta principal, respetando las tildes; añade las etiquetas complementarias si las necesitas. Copia `excerpt` en la descripción de búsqueda cuando esté habilitada. El subtítulo va al comienzo del HTML incluido en el documento.
3. En la vista HTML del editor, pega el bloque completo de HTML. Incluye el primer párrafo, la imagen con leyenda corta, el subtítulo, el resto del cuerpo y el aviso con crédito enlazado al final; no copies las marcas de cierre del bloque de código Markdown.
4. El bloque utiliza la URL de Pexels para que la imagen sea visible durante la preparación. Para servirla desde Blogger, sube el JPG local con su herramienta de imágenes y sustituye el `src` por la URL que genere, conservando `alt`, anchura, altura y crédito. Comprueba la portada después de sustituirla.
5. Configura manualmente la fecha y hora indicadas con el blog en Europe/Madrid. Blogger no toma la fecha ni el autor del texto pegado. El nombre de autor de la demo es ficticio y puede diferir del perfil real de Blogger; no crees perfiles reales para simularlo.
6. Revisa la entrada como borrador antes de publicarla.

## Procedencia de las imágenes

Las fotografías se han descargado de Pexels y recortado desde su servicio de imágenes a 16:9. Su [licencia](https://www.pexels.com/license/) permite el uso gratuito y la modificación con las condiciones indicadas por el sitio; no supone dominio público ni autoriza a afirmar que una persona fotografiada respalda el proyecto. Se mantiene la atribución aunque no sea obligatoria según la licencia consultada.

| Artículo | Fotógrafo y ficha original |
| --- | --- |
| Los barrios que quieren volver a encontrarse en la calle | [Guerrero De la Luz](https://www.pexels.com/photo/people-walking-on-the-street-14264400/) |
| El tren cercano se juega su futuro en los viajes de cada día | [selmate](https://www.pexels.com/photo/railway-station-platform-16780213/) |
| Un huerto vecinal donde también se cultiva el relevo entre generaciones | [Alfo Medeiros](https://www.pexels.com/photo/man-and-woman-watering-the-plants-12916211/) |
| El mercado de barrio busca su sitio en la compra de la semana | [CARLOSCRUZ ARTEGRAFIA](https://www.pexels.com/photo/a-fresh-vegetables-on-the-market-11097810/) |
| Compartir local para sostener el pequeño comercio | [Raphael Loquellano](https://www.pexels.com/photo/people-by-the-cafe-counter-16139853/) |
| La biblioteca que invita a leer sin mirar el reloj | [Ayşe İpek](https://www.pexels.com/photo/books-in-the-library-13278839/) |
| El cine de barrio defiende la emoción de una pantalla compartida | [Anand M](https://www.pexels.com/photo/modern-empty-cinema-hall-with-black-seats-29505262/) |
| Antes de cambiar de portátil, una conversación con el taller | [Oelnbod](https://www.pexels.com/photo/close-up-of-laptop-repair-with-tools-37821110/) |
| El móvil que deja espacio para terminar una conversación | [Atahan Demir](https://www.pexels.com/photo/hand-holding-phone-12079714/) |
| El fútbol de base también se gana aprendiendo a ser equipo | [Omar Ramadan](https://www.pexels.com/photo/a-ball-on-a-football-field-9468611/) |
| Una ruta ciclista donde el ritmo lo marca el grupo | [Tuvalum](https://www.pexels.com/photo/cyclists-cycling-on-road-17239276/) |
| También tenemos derecho a entender las noticias sin correr | [Mateusz Dach](https://www.pexels.com/photo/man-reading-newspaper-347682/) |
