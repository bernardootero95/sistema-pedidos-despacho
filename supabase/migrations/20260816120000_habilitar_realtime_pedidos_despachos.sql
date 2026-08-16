-- ============================================================================
-- Habilita Supabase Realtime para pedidos y despachos
-- ============================================================================
-- postgres_changes (usado por el hook useRealtimeSubscription en el
-- frontend) solo emite eventos de las tablas agregadas explícitamente a la
-- publicación `supabase_realtime` — no basta con suscribirse desde el
-- cliente. Sin esto, los canales se conectan pero nunca reciben nada.
--
-- No se toca REPLICA IDENTITY: el frontend solo usa el evento como señal
-- para volver a pedir su página actual (ver useRealtimeSubscription.js),
-- nunca lee payload.old, así que el DEFAULT (basado en la primary key)
-- alcanza — FULL solo sumaría overhead de WAL sin necesidad real.
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE pedidos_cabecera;
ALTER PUBLICATION supabase_realtime ADD TABLE despachos;
ALTER PUBLICATION supabase_realtime ADD TABLE despachos_pedidos;
