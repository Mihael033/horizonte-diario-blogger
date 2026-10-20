// Menú de secciones. En escritorio [data-js=menu] es la fila de secciones (siempre visible); en
// móvil el botón la abre como panel. Estado: is-open en el menú + aria-expanded en el botón.
// El menú nunca lleva hidden; el velo [data-js=scrim] sí.
import { js, jsAll, focusables, trapFocus, lockScroll } from './dom.js';

export function initMenu() {
  const toggle = js('menu-toggle');
  const menu = js('menu');
  if (!toggle || !menu) return;
  const scrim = js('scrim');
  let release = null;

  const isOpen = () => menu.classList.contains('is-open');

  // Abierto como panel (móvil) se comporta como diálogo modal; en escritorio es la fila de
  // secciones, así que la semántica de diálogo se pone al abrir y se quita al cerrar.
  function setDialog(on) {
    if (on) {
      menu.setAttribute('role', 'dialog');
      menu.setAttribute('aria-modal', 'true');
      if (document.getElementById('menu-title')) menu.setAttribute('aria-labelledby', 'menu-title');
      else menu.setAttribute('aria-label', 'Secciones');
    } else {
      for (const a of ['role', 'aria-modal', 'aria-labelledby', 'aria-label']) menu.removeAttribute(a);
    }
  }

  function open() {
    menu.classList.add('is-open');
    setDialog(true);
    toggle.setAttribute('aria-expanded', 'true');
    if (scrim) scrim.hidden = false;
    lockScroll(true);
    release = trapFocus(menu);
    const first = focusables(menu).find((el) => el.matches('a[href]')) || focusables(menu)[0];
    first?.focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    menu.classList.remove('is-open');
    setDialog(false);
    toggle.setAttribute('aria-expanded', 'false');
    if (scrim) scrim.hidden = true;
    lockScroll(false);
    release?.();
    release = null;
    if (restoreFocus) toggle.focus();
  }

  toggle.addEventListener('click', () => (isOpen() ? close() : open()));
  for (const btn of jsAll('menu-close')) btn.addEventListener('click', () => close());
  scrim?.addEventListener('click', () => close());
  menu.addEventListener('click', (e) => { if (e.target.closest('a[href]')) close({ restoreFocus: false }); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  // Al pasar a escritorio (botón oculto) el panel se cierra solo.
  window.addEventListener('resize', () => { if (isOpen() && toggle.offsetParent === null) close({ restoreFocus: false }); });
}
