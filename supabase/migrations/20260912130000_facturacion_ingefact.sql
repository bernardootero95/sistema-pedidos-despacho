-- ----------------------------------------------------------------------------
-- Integración con IngeFact (facturación electrónica DIAN): columnas para
-- registrar el resultado del envío. La llamada a la API externa de IngeFact
-- (HTTP, con su propia API key) no puede resolverse en una función de
-- Postgres como el resto de operaciones críticas del proyecto -- se hace en
-- la Edge Function enviar-factura-ingefact (SERVICE_ROLE), que después
-- escribe aquí el resultado. No se agrega un nuevo patrón de estado: se
-- reutiliza "columna NULL = pendiente" (ingefact_factura_id) igual que
-- fecha_entrega en pedidos_cabecera.
-- ----------------------------------------------------------------------------

-- Cachea el cliente ya creado en IngeFact para no duplicarlo en cada envío
-- (la API externa de IngeFact no permite buscar un cliente por número de
-- identificación, solo por texto libre).
ALTER TABLE public.clientes
  ADD COLUMN ingefact_cliente_id uuid;

ALTER TABLE public.pedidos_cabecera
  ADD COLUMN ingefact_factura_id uuid,
  ADD COLUMN ingefact_numero_factura character varying(50),
  ADD COLUMN ingefact_enviado_en timestamp with time zone;

COMMENT ON COLUMN public.clientes.ingefact_cliente_id IS
  'ID del cliente ya creado en IngeFact (empresa_id propio de IngeFact). NULL = aún no se ha facturado a este cliente.';
COMMENT ON COLUMN public.pedidos_cabecera.ingefact_factura_id IS
  'ID de la factura en IngeFact una vez enviada a la DIAN. NULL = pedido aún no facturado.';
COMMENT ON COLUMN public.pedidos_cabecera.ingefact_numero_factura IS
  'Número completo de la factura (prefijo + consecutivo) devuelto por IngeFact, solo para mostrar en el detalle del pedido.';
COMMENT ON COLUMN public.pedidos_cabecera.ingefact_enviado_en IS
  'Fecha/hora en que se envió la factura a IngeFact.';
