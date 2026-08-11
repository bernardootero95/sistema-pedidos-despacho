-- ============================================================================
-- RLS granular por rol + defensa contra escalada de privilegios
-- ============================================================================
-- Reemplaza las políticas "USING (true) WITH CHECK (true)" que permitían a
-- cualquier usuario autenticado leer/escribir cualquier fila sin importar
-- su rol. Se centraliza la resolución del rol en obtener_rol_actual() para
-- no repetir el JOIN perfiles->roles en cada política.
--
-- Diseño:
--   - No se usa roles.permisos (jsonb) todavía: hoy está vacío para
--     vendedor/despachador/repartidor, así que construir un motor genérico
--     sobre permisos no definidos sería abstracción prematura. Se hardcodean
--     los nombres de rol; cuando el negocio defina permisos granulares
--     reales, el único punto a tocar es obtener_rol_actual() y las políticas.
--   - pedidos_detalle y despachos_pedidos NO reciben política de INSERT:
--     su alta ocurre exclusivamente dentro de crear_pedido_transaccional y
--     crear_despacho_transaccional (SECURITY DEFINER). No se abre otra vía.
--   - perfiles tiene doble candado: políticas RLS + trigger que bloquea
--     cambios de rol_id/estado si quien edita no es gerencia/soporte,
--     como defensa en profundidad ante un futuro error de política.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Función helper: rol del usuario autenticado actual
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obtener_rol_actual()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.nombre
  FROM perfiles p
  JOIN roles r ON r.id = p.rol_id
  WHERE p.id = auth.uid()
    AND p.estado = true
    AND p.eliminado IS NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION obtener_rol_actual() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Trigger anti-escalada de privilegios sobre perfiles
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloquear_autoescalada_privilegios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF obtener_rol_actual() NOT IN ('gerencia', 'soporte') THEN
    IF NEW.rol_id IS DISTINCT FROM OLD.rol_id THEN
      RAISE EXCEPTION 'No tienes permiso para cambiar el rol de un usuario.';
    END IF;
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
      RAISE EXCEPTION 'No tienes permiso para activar/desactivar usuarios.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_autoescalada ON perfiles;
CREATE TRIGGER trg_bloquear_autoescalada
  BEFORE UPDATE ON perfiles
  FOR EACH ROW EXECUTE FUNCTION bloquear_autoescalada_privilegios();

-- ----------------------------------------------------------------------------
-- 3. PERFILES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Lectura de perfiles activos" ON perfiles;
DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON perfiles;
DROP POLICY IF EXISTS "Permitir actualizacion a usuarios autorizados" ON perfiles;

CREATE POLICY "perfiles_select_activos" ON perfiles
  FOR SELECT TO authenticated
  USING (estado = true AND eliminado IS NULL);

CREATE POLICY "perfiles_select_admin_todos" ON perfiles
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('gerencia', 'soporte'));

CREATE POLICY "perfiles_update_propio" ON perfiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "perfiles_update_admin" ON perfiles
  FOR UPDATE TO authenticated
  USING (obtener_rol_actual() IN ('gerencia', 'soporte'))
  WITH CHECK (obtener_rol_actual() IN ('gerencia', 'soporte'));

CREATE POLICY "perfiles_insert_admin" ON perfiles
  FOR INSERT TO authenticated
  WITH CHECK (obtener_rol_actual() IN ('gerencia', 'soporte'));

-- Sin política de DELETE: el alta/baja de personal usa soft delete (columna
-- 'eliminado') vía UPDATE, nunca DELETE físico sobre auth.users/perfiles.

-- ----------------------------------------------------------------------------
-- 4. CLIENTES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Acceso total a clientes para usuarios autenticados" ON clientes;

CREATE POLICY "clientes_select_operativo" ON clientes
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'despachador', 'repartidor'));

CREATE POLICY "clientes_insert_comercial" ON clientes
  FOR INSERT TO authenticated
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor'));

CREATE POLICY "clientes_update_comercial" ON clientes
  FOR UPDATE TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor'))
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor'));

-- ----------------------------------------------------------------------------
-- 5. PRODUCTOS (catálogo sincronizado desde ERP; escritura manual solo admin)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Acceso total productos" ON productos;

CREATE POLICY "productos_select_operativo" ON productos
  FOR SELECT TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'despachador', 'repartidor'));

CREATE POLICY "productos_write_admin" ON productos
  FOR ALL TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia'))
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia'));

-- ----------------------------------------------------------------------------
-- 6. VEHÍCULOS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON vehiculos;
DROP POLICY IF EXISTS "Permitir inserción a usuarios autenticados" ON vehiculos;
DROP POLICY IF EXISTS "Permitir actualización a usuarios autenticados" ON vehiculos;
DROP POLICY IF EXISTS "Permitir eliminación a usuarios autenticados" ON vehiculos;

CREATE POLICY "vehiculos_select_operativo" ON vehiculos
  FOR SELECT TO authenticated
  USING (
    obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
    OR conductor_id = auth.uid()
  );

CREATE POLICY "vehiculos_write_logistica" ON vehiculos
  FOR ALL TO authenticated
  USING (obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador'))
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador'));

-- ----------------------------------------------------------------------------
-- 7. PEDIDOS (cabecera y detalle)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en cabecera" ON pedidos_cabecera;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en detalle" ON pedidos_detalle;

CREATE POLICY "pedidos_cabecera_select_operativo" ON pedidos_cabecera
  FOR SELECT TO authenticated
  USING (
    obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'despachador')
    OR EXISTS (
      SELECT 1 FROM despachos_pedidos dp
      JOIN despachos d ON d.id = dp.despacho_id
      WHERE dp.pedido_id = pedidos_cabecera.id
        AND d.repartidor_id = auth.uid()
    )
  );

-- El alta real ocurre en crear_pedido_transaccional (SECURITY DEFINER), que
-- no depende de esta política. Se deja como cierre por si se requiere un
-- insert directo controlado en el futuro.
CREATE POLICY "pedidos_cabecera_insert_comercial" ON pedidos_cabecera
  FOR INSERT TO authenticated
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor'));

-- Un vendedor solo puede editar (ej. anular) pedidos que sigan 'pendiente';
-- una vez el despachador lo tomó, solo gerencia/soporte pueden corregirlo.
CREATE POLICY "pedidos_cabecera_update_comercial" ON pedidos_cabecera
  FOR UPDATE TO authenticated
  USING (
    obtener_rol_actual() IN ('gerencia', 'soporte')
    OR (obtener_rol_actual() = 'vendedor' AND estado = 'pendiente')
  )
  WITH CHECK (
    obtener_rol_actual() IN ('gerencia', 'soporte')
    OR (obtener_rol_actual() = 'vendedor' AND estado = 'pendiente')
  );

CREATE POLICY "pedidos_detalle_select_operativo" ON pedidos_detalle
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos_cabecera pc
      WHERE pc.id = pedidos_detalle.pedido_id
        AND (
          obtener_rol_actual() IN ('soporte', 'gerencia', 'vendedor', 'despachador')
          OR EXISTS (
            SELECT 1 FROM despachos_pedidos dp
            JOIN despachos d ON d.id = dp.despacho_id
            WHERE dp.pedido_id = pc.id
              AND d.repartidor_id = auth.uid()
          )
        )
    )
  );

-- Sin políticas de INSERT/UPDATE/DELETE en pedidos_detalle: todo pasa por
-- crear_pedido_transaccional (SECURITY DEFINER). No se abre otra vía.

-- ----------------------------------------------------------------------------
-- 8. DESPACHOS (cabecera y detalle)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Permitir lectura y escritura a usuarios autenticados en despach" ON despachos;
DROP POLICY IF EXISTS "Permitir lectura y escritura a usuarios autenticados en despach" ON despachos_pedidos;

CREATE POLICY "despachos_select_operativo" ON despachos
  FOR SELECT TO authenticated
  USING (
    obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
    OR repartidor_id = auth.uid()
  );

-- El alta real ocurre en crear_despacho_transaccional (SECURITY DEFINER).
CREATE POLICY "despachos_insert_logistica" ON despachos
  FOR INSERT TO authenticated
  WITH CHECK (obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador'));

-- El repartidor asignado solo puede actualizar SU despacho (pensado para
-- cuando se implemente el cambio de estado en ruta: en_ruta / entregado).
CREATE POLICY "despachos_update_logistica" ON despachos
  FOR UPDATE TO authenticated
  USING (
    obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
    OR repartidor_id = auth.uid()
  )
  WITH CHECK (
    obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
    OR repartidor_id = auth.uid()
  );

CREATE POLICY "despachos_pedidos_select_operativo" ON despachos_pedidos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM despachos d
      WHERE d.id = despachos_pedidos.despacho_id
        AND (
          obtener_rol_actual() IN ('soporte', 'gerencia', 'despachador')
          OR d.repartidor_id = auth.uid()
        )
    )
  );

-- Sin política de INSERT en despachos_pedidos: el alta ocurre exclusivamente
-- dentro de crear_despacho_transaccional (SECURITY DEFINER).

-- ----------------------------------------------------------------------------
-- 9. Endurecimiento de privilegios base (defensa en profundidad)
-- ----------------------------------------------------------------------------
-- Esta aplicación no tiene flujo anónimo (requiere login). anon no debería
-- tener ningún privilegio de base, como capa extra por si RLS se desactiva
-- por error en el futuro.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON FUNCTION crear_pedido_transaccional(UUID, UUID, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION crear_despacho_transaccional(UUID, UUID, TIMESTAMPTZ, TEXT, UUID[]) FROM anon;
REVOKE EXECUTE ON FUNCTION toggle_user_status(UUID, BOOLEAN) FROM anon;