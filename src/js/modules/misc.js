// Detalles: fecha de hoy, año del pie, enlaces a etiquetas y boletín de demostración.
import { jsAll, toast } from './dom.js';
import { formatToday } from './format.js';

export function initToday(now = new Date()) {
  const { text, iso } = formatToday(now);
  for (const el of jsAll('date-today')) {
    el.textContent = text;
    if (el.tagName === 'TIME') el.setAttribute('datetime', iso);
  }
  for (const el of jsAll('year')) el.textContent = String(now.getFullYear());
}

/** Los enlaces a etiquetas se montan en el tema con el nombre tal cual: aquí se codifican. */
export function initLabelLinks() {
  for (const a of jsAll('label-link')) {
    const m = /^(.*\/search\/label\/)(.+)$/.exec(a.getAttribute('href') || '');
    if (!m) continue;
    let name = m[2];
    try { name = decodeURIComponent(name); } catch { /* ya venía sin codificar */ }
    a.setAttribute('href', m[1] + encodeURIComponent(name));
  }
}

/**
 * Formularios de boletín [data-js=newsletter] sin servicio configurado (action="#"): no envían
 * nada y lo explican. Con el código de Mailchimp/Brevo/Substack pegado en el gadget funcionan solos.
 */
export function initNewsletter() {
  for (const form of jsAll('newsletter')) {
    const action = form.getAttribute('action') || '';
    if (action && action !== '#') continue;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;
      toast('¡Gracias! (Demostración: conecta tu servicio de boletines en Diseño → «Recibe el boletín»).');
      form.reset();
    });
  }
}
