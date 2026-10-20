// Se ejecuta en el <head> antes del CSS: aplica el tema guardado (sin parpadeo) y marca que hay JS.
// Sin preferencia guardada no se pone data-theme y el CSS sigue prefers-color-scheme.
(function (doc) {
  var root = doc.documentElement;
  root.className = root.className.replace(/\bno-js\b/, '') + ' has-js';
  try {
    var theme = localStorage.getItem('hd-theme');
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  } catch (_err) { /* almacenamiento bloqueado: se queda el tema del sistema */ }
})(document);
