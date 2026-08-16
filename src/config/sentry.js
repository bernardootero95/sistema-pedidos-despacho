import * as Sentry from "@sentry/react";

/**
 * Inicializa Sentry solo si hay un DSN configurado (VITE_SENTRY_DSN). Sin
 * DSN, es un no-op silencioso a propósito: nadie tiene que crear una
 * cuenta de Sentry para levantar el proyecto en local, y los ambientes de
 * un tenant que todavía no configuró observabilidad no rompen por esto.
 *
 * No hace falta guardar nada en ErrorBoundary.componentDidCatch para
 * evitar reportar sin init: Sentry.captureException ya es un no-op
 * seguro si el SDK nunca se inicializó, así que la decisión de "¿está
 * activo Sentry?" vive en un solo lugar (acá), no duplicada.
 */
export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Los datos de clientes/pedidos que puedan colarse en breadcrumbs o
    // contexto de error no deberían salir del sistema sin que alguien lo
    // decida explícitamente más adelante.
    sendDefaultPii: false,
  });
};
