/**
 * Normaliza un texto para buscar sin importar mayúsculas ni tildes
 * ("devolución" coincide con "devolucion").
 */
const normalizar = (texto) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const bloqueVisible = (bloque, rol, settings) =>
  (!bloque.roles || bloque.roles.includes(rol)) &&
  (!bloque.opcion || Boolean(settings?.[bloque.opcion]));

const textoBloque = (bloque) =>
  [bloque.titulo, ...(bloque.pasos ?? []), ...(bloque.notas ?? [])].join(" ");

/**
 * Secciones del instructivo que aplican al usuario: quita las secciones y
 * bloques que su rol no puede usar o que dependen de una opción apagada en
 * la empresa, y aplica la búsqueda.
 *
 * Con búsqueda: si coincide el título o el resumen de la sección, se deja
 * completa; si no, solo los bloques que coinciden. Una sección sin bloques
 * visibles se omite.
 *
 * @param {Array} secciones SECCIONES_AYUDA
 * @param {string} rol rol del usuario actual
 * @param {Record<string, boolean>} settings opciones de la empresa (useSettings)
 * @param {string} [busqueda]
 */
export const getSeccionesVisibles = (secciones, rol, settings, busqueda = "") => {
  if (!rol) return [];
  const termino = normalizar(busqueda.trim());

  return secciones.flatMap((seccion) => {
    if (!seccion.roles.includes(rol)) return [];

    const bloques = seccion.bloques.filter((b) => bloqueVisible(b, rol, settings));
    const coincideSeccion =
      !termino || normalizar(`${seccion.titulo} ${seccion.resumen}`).includes(termino);
    const bloquesFinales = coincideSeccion
      ? bloques
      : bloques.filter((b) => normalizar(textoBloque(b)).includes(termino));

    return bloquesFinales.length > 0 ? [{ ...seccion, bloques: bloquesFinales }] : [];
  });
};
