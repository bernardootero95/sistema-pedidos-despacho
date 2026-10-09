const CLAVE_ULTIMO_REINTENTO = "chunk-reload-ultimo-intento";
const VENTANA_ANTI_BUCLE_MS = 10_000;

/**
 * Tras un deploy, los chunks lazy con hash del build anterior dejan de
 * existir: una pestaña que seguía abierta con el bundle viejo falla al
 * navegar a una página que aún no había cargado ("Failed to fetch
 * dynamically imported module"). Recargar trae el index nuevo y arregla
 * el problema sin que el usuario vea el error.
 *
 * Devuelve true si recargó. La marca en sessionStorage evita un bucle de
 * recargas si el fallo no es de versión (ej. servidor caído): dentro de
 * la ventana no se reintenta y el error sigue su curso hacia el
 * ErrorBoundary.
 */
export const recargarPorChunkDesactualizado = ({
  almacen = window.sessionStorage,
  recargar = () => window.location.reload(),
  ahora = Date.now(),
} = {}) => {
  try {
    const ultimo = Number(almacen.getItem(CLAVE_ULTIMO_REINTENTO));
    if (ultimo && ahora - ultimo < VENTANA_ANTI_BUCLE_MS) return false;
    almacen.setItem(CLAVE_ULTIMO_REINTENTO, String(ahora));
  } catch {
    // Sin sessionStorage no podemos garantizar que no haya bucle: mejor
    // dejar que el ErrorBoundary ofrezca el botón manual de recargar.
    return false;
  }
  recargar();
  return true;
};

export const initChunkReload = () => {
  window.addEventListener("vite:preloadError", (event) => {
    // preventDefault solo si recargamos; si no, el error se propaga al
    // ErrorBoundary y a Sentry como hasta ahora. Con preventDefault Vite
    // resuelve el import con `undefined`: las páginas del router lo absorben
    // con lazyPagina (lazyPagina.js) para que React no falle antes de que la
    // recarga surta efecto.
    if (recargarPorChunkDesactualizado()) event.preventDefault();
  });
};
