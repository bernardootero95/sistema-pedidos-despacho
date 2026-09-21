-- ============================================================================
-- BASELINE 03/04 -- Triggers, RLS, políticas, permisos y realtime
-- ============================================================================
-- Requiere 01_esquema.sql y 02_funciones.sql. Ver supabase/baseline/README.md.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
CREATE TRIGGER set_timestamp_configuracion_sistema BEFORE UPDATE ON public.configuracion_sistema FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trg_bloquear_edicion_directa_despacho BEFORE UPDATE ON public.despachos FOR EACH ROW EXECUTE FUNCTION bloquear_edicion_directa_despacho();
CREATE TRIGGER set_timestamp_metodos_pago BEFORE UPDATE ON public.metodos_pago FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trg_proteger_metodo_efectivo BEFORE UPDATE ON public.metodos_pago FOR EACH ROW EXECUTE FUNCTION proteger_metodo_efectivo();
CREATE TRIGGER trg_sincronizar_total_pagado AFTER INSERT ON public.pagos FOR EACH ROW EXECUTE FUNCTION sincronizar_total_pagado();
CREATE TRIGGER audit_pedidos_cabecera AFTER INSERT OR UPDATE ON public.pedidos_cabecera FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER trg_bloquear_edicion_directa_pedido BEFORE UPDATE ON public.pedidos_cabecera FOR EACH ROW EXECUTE FUNCTION bloquear_edicion_directa_pedido();
CREATE TRIGGER audit_perfiles AFTER INSERT OR DELETE OR UPDATE ON public.perfiles FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER set_timestamp_perfiles BEFORE UPDATE ON public.perfiles FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trg_bloquear_autoescalada BEFORE UPDATE ON public.perfiles FOR EACH ROW EXECUTE FUNCTION bloquear_autoescalada_privilegios();
CREATE TRIGGER set_timestamp_productos_precios BEFORE UPDATE ON public.productos_precios FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER set_timestamp_productos_precios_mayoristas BEFORE UPDATE ON public.productos_precios_mayoristas FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER audit_roles AFTER INSERT OR DELETE OR UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER set_timestamp_roles BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER set_timestamp_tipos_precio BEFORE UPDATE ON public.tipos_precio FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER update_vehiculos_timestamp BEFORE UPDATE ON public.vehiculos FOR EACH ROW EXECUTE FUNCTION update_vehiculos_modtime();

-- ----------------------------------------------------------------------------
-- Row Level Security (todas las tablas menos auth_intentos_fallidos, que solo
-- usa el hook de contraseñas con service_role)
-- ----------------------------------------------------------------------------
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_cabecera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despachos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despachos_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_cabecera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos_precios_mayoristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_identificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Políticas
-- ----------------------------------------------------------------------------
CREATE POLICY auditoria_select_pedidos ON public.auditoria AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((tabla)::text = 'pedidos_cabecera'::text) AND (obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text]))));

CREATE POLICY clientes_insert_comercial ON public.clientes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'vendedor'::text, 'despachador'::text, 'cajera'::text])));
CREATE POLICY clientes_select_operativo ON public.clientes AS PERMISSIVE FOR SELECT TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'vendedor'::text, 'despachador'::text, 'repartidor'::text, 'cajera'::text])));
CREATE POLICY clientes_update_comercial ON public.clientes AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'vendedor'::text, 'cajera'::text])))
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'vendedor'::text, 'cajera'::text])));

CREATE POLICY compras_cabecera_select_operativo ON public.compras_cabecera AS PERMISSIVE FOR SELECT TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])));
CREATE POLICY compras_detalle_select_operativo ON public.compras_detalle AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM compras_cabecera cc
  WHERE ((cc.id = compras_detalle.compra_id) AND (obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text]))))));

CREATE POLICY configuracion_sistema_select ON public.configuracion_sistema AS PERMISSIVE FOR SELECT TO authenticated
  USING ((obtener_rol_actual() IS NOT NULL));
CREATE POLICY configuracion_sistema_update_admin ON public.configuracion_sistema AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text])))
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text])));

CREATE POLICY despachos_insert_logistica ON public.despachos AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])));
CREATE POLICY despachos_select_operativo ON public.despachos AS PERMISSIVE FOR SELECT TO authenticated
  USING (((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])) OR (repartidor_id = auth.uid()) OR ((obtener_rol_actual() = 'vendedor'::text) AND despacho_incluye_pedido_de_vendedor(id))));
CREATE POLICY despachos_update_logistica ON public.despachos AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])) OR (repartidor_id = auth.uid())))
  WITH CHECK (((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])) OR (repartidor_id = auth.uid())));
CREATE POLICY despachos_pedidos_select_operativo ON public.despachos_pedidos AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM despachos d
  WHERE ((d.id = despachos_pedidos.despacho_id) AND ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])) OR (d.repartidor_id = auth.uid()))))) OR ((obtener_rol_actual() = 'vendedor'::text) AND vendedor_es_dueno_del_pedido(pedido_id))));

CREATE POLICY metodos_pago_select_operativo ON public.metodos_pago AS PERMISSIVE FOR SELECT TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'vendedor'::text, 'despachador'::text, 'repartidor'::text, 'cajera'::text])));
CREATE POLICY metodos_pago_write_admin ON public.metodos_pago AS PERMISSIVE FOR ALL TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text])))
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text])));

CREATE POLICY "Lectura municipios" ON public.municipios AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY pagos_select_segun_origen ON public.pagos AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((pedido_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM pedidos_cabecera pc
  WHERE (pc.id = pagos.pedido_id)))) OR ((compra_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM compras_cabecera cc
  WHERE (cc.id = pagos.compra_id))))));

CREATE POLICY pedidos_cabecera_insert_comercial ON public.pedidos_cabecera AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'vendedor'::text, 'despachador'::text, 'cajera'::text])));
CREATE POLICY pedidos_cabecera_select_operativo ON public.pedidos_cabecera AS PERMISSIVE FOR SELECT TO authenticated
  USING (((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])) OR ((obtener_rol_actual() = ANY (ARRAY['vendedor'::text, 'cajera'::text])) AND (vendedor_id = auth.uid())) OR (EXISTS ( SELECT 1
   FROM (despachos_pedidos dp
     JOIN despachos d ON ((d.id = dp.despacho_id)))
  WHERE ((dp.pedido_id = pedidos_cabecera.id) AND (d.repartidor_id = auth.uid()))))));
CREATE POLICY pedidos_cabecera_update_comercial ON public.pedidos_cabecera AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((obtener_rol_actual() = ANY (ARRAY['gerencia'::text, 'soporte'::text])) OR ((obtener_rol_actual() = 'vendedor'::text) AND ((estado)::text = 'pendiente'::text) AND (vendedor_id = auth.uid()))))
  WITH CHECK (((obtener_rol_actual() = ANY (ARRAY['gerencia'::text, 'soporte'::text])) OR ((obtener_rol_actual() = 'vendedor'::text) AND ((estado)::text = 'pendiente'::text) AND (vendedor_id = auth.uid()))));
CREATE POLICY pedidos_detalle_select_operativo ON public.pedidos_detalle AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pedidos_cabecera pc
  WHERE ((pc.id = pedidos_detalle.pedido_id) AND ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])) OR ((obtener_rol_actual() = ANY (ARRAY['vendedor'::text, 'cajera'::text])) AND (pc.vendedor_id = auth.uid())) OR (EXISTS ( SELECT 1
           FROM (despachos_pedidos dp
             JOIN despachos d ON ((d.id = dp.despacho_id)))
          WHERE ((dp.pedido_id = pc.id) AND (d.repartidor_id = auth.uid())))))))));

CREATE POLICY perfiles_insert_admin ON public.perfiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['gerencia'::text, 'soporte'::text])));
CREATE POLICY perfiles_select_activos ON public.perfiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (((estado = true) AND (eliminado IS NULL)));
CREATE POLICY perfiles_select_admin_todos ON public.perfiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['gerencia'::text, 'soporte'::text])));
CREATE POLICY perfiles_update_admin ON public.perfiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['gerencia'::text, 'soporte'::text])))
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['gerencia'::text, 'soporte'::text])));
CREATE POLICY perfiles_update_propio ON public.perfiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

CREATE POLICY productos_insert_despachador ON public.productos AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((obtener_rol_actual() = 'despachador'::text));
CREATE POLICY productos_select_operativo ON public.productos AS PERMISSIVE FOR SELECT TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'vendedor'::text, 'despachador'::text, 'repartidor'::text, 'cajera'::text])));
CREATE POLICY productos_write_admin ON public.productos AS PERMISSIVE FOR ALL TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text])))
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text])));
CREATE POLICY productos_precios_select_operativo ON public.productos_precios AS PERMISSIVE FOR SELECT TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'vendedor'::text, 'despachador'::text, 'cajera'::text])));
CREATE POLICY productos_precios_write_catalogo ON public.productos_precios AS PERMISSIVE FOR ALL TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])))
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])));
CREATE POLICY precios_mayoristas_select_admin ON public.productos_precios_mayoristas AS PERMISSIVE FOR SELECT TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text])));
CREATE POLICY precios_mayoristas_write_admin ON public.productos_precios_mayoristas AS PERMISSIVE FOR ALL TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text])))
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text])));

CREATE POLICY proveedores_insert_compras ON public.proveedores AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])));
CREATE POLICY proveedores_select_operativo ON public.proveedores AS PERMISSIVE FOR SELECT TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])));
CREATE POLICY proveedores_update_compras ON public.proveedores AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])))
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])));

CREATE POLICY "Lectura de roles para usuarios autenticados" ON public.roles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((estado = true));
CREATE POLICY "Lectura tipos_identificacion" ON public.tipos_identificacion AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY tipos_precio_select_operativo ON public.tipos_precio AS PERMISSIVE FOR SELECT TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'vendedor'::text, 'despachador'::text, 'cajera'::text])));
CREATE POLICY tipos_precio_write_admin ON public.tipos_precio AS PERMISSIVE FOR ALL TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text])))
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text])));

CREATE POLICY vehiculos_select_operativo ON public.vehiculos AS PERMISSIVE FOR SELECT TO authenticated
  USING (((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])) OR (conductor_id = auth.uid())));
CREATE POLICY vehiculos_write_logistica ON public.vehiculos AS PERMISSIVE FOR ALL TO authenticated
  USING ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])))
  WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['soporte'::text, 'gerencia'::text, 'despachador'::text])));

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
-- Tablas: los privilegios por defecto (01_esquema.sql) ya dan ALL a
-- authenticated y service_role y nada a anon. Única excepción: el estado de
-- intentos de login solo lo toca el hook de contraseñas (service_role).
REVOKE ALL ON TABLE public.auth_intentos_fallidos FROM authenticated;

-- Funciones internas o de RPC: se restringen respecto al default (PUBLIC +
-- authenticated + service_role). Con `authenticated` = las RPC que llama el
-- frontend; solo `service_role` = helpers internos y el hook de auth.
REVOKE ALL ON FUNCTION public.actualizar_estado_despacho_transaccional(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.actualizar_estado_entrega_pedido_transaccional(uuid, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crear_compra_transaccional(uuid, text, jsonb, timestamp with time zone, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crear_pedido_transaccional(uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.editar_pedido_transaccional(uuid, text, jsonb, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_abono_compra(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_abono_pedido(uuid, jsonb) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.cobrar_saldo_pedido(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.devolver_pagos(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hook_password_verification_attempt(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_pagos(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolver_precio_pedido(uuid, text, numeric, numeric, text, uuid) FROM PUBLIC, anon, authenticated;

-- El login consulta esto ANTES de autenticar (recuperación de contraseña).
GRANT EXECUTE ON FUNCTION public.tiene_correo_recuperacion(text) TO anon;

-- El Password Verification Hook lo invoca supabase_auth_admin.
GRANT EXECUTE ON FUNCTION public.hook_password_verification_attempt(jsonb) TO supabase_auth_admin;

COMMENT ON FUNCTION public.hook_password_verification_attempt(jsonb) IS 'Password Verification Hook (auditoría #11). Se activa manualmente en Authentication > Hooks del dashboard de Supabase; no queda activo solo con esta migración.';

-- ----------------------------------------------------------------------------
-- Realtime (las pantallas de pedidos y despachos se refrescan solas)
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_cabecera, public.despachos, public.despachos_pedidos;
