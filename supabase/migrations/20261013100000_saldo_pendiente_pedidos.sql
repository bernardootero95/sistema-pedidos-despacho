-- Saldo pendiente de un pedido como columna calculada (total - total_pagado).
-- Permite filtrar "pedidos con saldo" en el servidor con paginación, algo que
-- PostgREST no puede hacer comparando dos columnas. Es de solo lectura: se
-- recalcula sola cuando el trigger de pagos actualiza total_pagado.
ALTER TABLE pedidos_cabecera
  ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC
  GENERATED ALWAYS AS (GREATEST(total - total_pagado, 0)) STORED;

-- Índice parcial: solo los pedidos con saldo (una minoría) y no anulados.
CREATE INDEX IF NOT EXISTS idx_pedidos_cabecera_con_saldo
  ON pedidos_cabecera (creado DESC)
  WHERE saldo_pendiente > 0 AND estado <> 'anulado' AND eliminado IS NULL;
