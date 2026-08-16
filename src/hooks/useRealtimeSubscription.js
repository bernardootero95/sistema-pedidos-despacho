import { useEffect, useRef } from "react";
import { supabase } from "../config/supabase";

/**
 * Suscripción en vivo a cambios de una tabla vía Supabase Realtime
 * (.channel()/postgres_changes). Deliberadamente NO intenta mantener una
 * lista por sí solo (insertar/actualizar/borrar filas en un array local):
 * con paginación y búsqueda de por medio, saber si una fila nueva
 * "pertenece" a la página actual es ambiguo. En cambio, este hook solo
 * avisa que algo cambió — cada pantalla decide qué hacer (normalmente
 * volver a pedir su página actual, que ya es barato y siempre queda
 * consistente).
 *
 * @param {string} table - tabla de Postgres a escuchar
 * @param {(payload: object) => void} onChange - se llama en cada evento
 * @param {{ filter?: string, event?: 'INSERT'|'UPDATE'|'DELETE'|'*', enabled?: boolean }} [options]
 */
export function useRealtimeSubscription(table, onChange, options = {}) {
  const { filter, event = "*", enabled = true } = options;

  // Ref para no re-suscribirse cada vez que el caller pasa un onChange con
  // identidad nueva (lo normal, ya que casi siempre es una arrow function
  // inline) — el efecto de abajo solo depende de table/filter/event/enabled.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const channel = supabase
      .channel(`realtime:${table}:${filter || "all"}:${event}`)
      .on(
        "postgres_changes",
        { event, schema: "public", table, filter },
        (payload) => onChangeRef.current(payload),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, event, enabled]);
}
