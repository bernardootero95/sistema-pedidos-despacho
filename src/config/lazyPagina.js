import { lazy } from "react";

/**
 * Resuelve la carga de una página lazy. Si el import resuelve `undefined`,
 * se queda pendiente en vez de entregárselo a React.
 *
 * Por qué: tras un deploy, una pestaña con el bundle viejo falla al cargar el
 * chunk de una página nueva. El helper de precarga de Vite avisa con el
 * evento `vite:preloadError` y, como initChunkReload (chunkReload.js) llama a
 * `preventDefault()` para recargar sin mostrar el error, Vite resuelve el
 * import con `undefined` en lugar de rechazarlo (y el `.then(m => ({ default:
 * ... }))` de cada página no llega a ejecutarse porque va dentro de ese
 * helper). React, al recibir `undefined`, lanza «Cannot read properties of
 * undefined (reading 'default')» un instante antes de que la recarga surta
 * efecto: el usuario ve el ErrorBoundary y Sentry registra un error falso.
 *
 * Quedarse pendiente deja la pantalla en el fallback de Suspense hasta que la
 * recarga (ya disparada) la reemplaza. Un rechazo real del import sigue
 * propagándose al ErrorBoundary.
 *
 * @template T
 * @param {() => Promise<T | undefined>} importador
 * @returns {Promise<T>}
 */
export const resolverCargaPagina = (importador) =>
  importador().then((modulo) => (modulo === undefined ? new Promise(() => {}) : modulo));

/** React.lazy con la protección de resolverCargaPagina, para las páginas del router. */
export const lazyPagina = (importador) => lazy(() => resolverCargaPagina(importador));
