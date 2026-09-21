-- ============================================================================
-- BASELINE 01/04 -- Esquema (tablas, secuencias, restricciones, índices)
-- ============================================================================
-- Estado del esquema `public` del proyecto demo al 2026-09-21 (todas las
-- migraciones de supabase/migrations aplicadas). Sirve para crear una empresa
-- nueva sobre un proyecto Supabase vacío SIN reproducir migración por migración
-- (el volcado antiguo schema_dump.sql no incluye triggers, compras, tipos de
-- precio ni pagos). Ver supabase/baseline/README.md.
-- Orden de aplicación: 01_esquema -> 02_funciones -> 03_seguridad -> 04_datos.
-- ============================================================================

-- Privilegios por defecto: los objetos nuevos del esquema public no se le
-- otorgan a `anon` (mismo endurecimiento que 20260812162649_endurecer_
-- privilegios_default_anon.sql). Debe ir ANTES de crear las tablas.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- ----------------------------------------------------------------------------
-- Secuencias
-- ----------------------------------------------------------------------------
CREATE SEQUENCE public.auditoria_id_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;
CREATE SEQUENCE public.municipios_id_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;
CREATE SEQUENCE public.roles_id_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;
CREATE SEQUENCE public.tipos_identificacion_id_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

-- ----------------------------------------------------------------------------
-- Tablas
-- ----------------------------------------------------------------------------
CREATE TABLE public.auditoria (
  id bigint DEFAULT nextval('auditoria_id_seq'::regclass) NOT NULL,
  tabla character varying(50) NOT NULL,
  operacion character varying(10) NOT NULL,
  registro_id character varying(50) NOT NULL,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  usuario_id uuid,
  creado timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.auth_intentos_fallidos (
  user_id uuid NOT NULL,
  intentos integer DEFAULT 0 NOT NULL,
  primer_intento_en timestamp with time zone DEFAULT now() NOT NULL,
  bloqueado_hasta timestamp with time zone
);

CREATE TABLE public.clientes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  numero_identificacion character varying(50) NOT NULL,
  tipo_identificacion character varying(20) NOT NULL,
  tipo_organizacion character varying(20) NOT NULL,
  primer_nombre character varying(100),
  otros_nombres character varying(100),
  primer_apellido character varying(100),
  otros_apellidos character varying(100),
  razon_social character varying(255),
  nombre_comercial character varying(255),
  direccion text NOT NULL,
  ciudad_municipio character varying(100) NOT NULL,
  correo character varying(150),
  telefono character varying(50),
  estado boolean DEFAULT true,
  creado timestamp with time zone DEFAULT now(),
  actualizado timestamp with time zone DEFAULT now(),
  eliminado timestamp with time zone,
  codigo_municipio character varying(10),
  digito_verificacion character varying(1),
  ingefact_cliente_id uuid
);

CREATE TABLE public.compras_cabecera (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  numero_compra character varying(50) NOT NULL,
  proveedor_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  fecha_compra timestamp with time zone DEFAULT now(),
  estado character varying(20) DEFAULT 'registrada'::character varying NOT NULL,
  total numeric(12,2) DEFAULT 0 NOT NULL,
  notas text,
  creado timestamp with time zone DEFAULT now(),
  actualizado timestamp with time zone,
  eliminado timestamp with time zone,
  total_pagado numeric(12,2) DEFAULT 0 NOT NULL
);

CREATE TABLE public.compras_detalle (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  compra_id uuid NOT NULL,
  producto_id uuid NOT NULL,
  cantidad numeric(12,2) NOT NULL,
  costo_unitario numeric(12,2) NOT NULL,
  subtotal_linea numeric(12,2) NOT NULL,
  creado timestamp with time zone DEFAULT now()
);

CREATE TABLE public.configuracion_sistema (
  id boolean DEFAULT true NOT NULL,
  metodos_pago_activo boolean DEFAULT false NOT NULL,
  abonos_pedidos_activo boolean DEFAULT false NOT NULL,
  abonos_compras_activo boolean DEFAULT false NOT NULL,
  creado timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  actualizado timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.despachos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  codigo_despacho character varying(20) NOT NULL,
  vehiculo_id uuid NOT NULL,
  repartidor_id uuid NOT NULL,
  estado character varying(20) DEFAULT 'creado'::character varying,
  fecha_despacho timestamp with time zone DEFAULT now(),
  notas text,
  creado_en timestamp with time zone DEFAULT now(),
  actualizado_en timestamp with time zone DEFAULT now(),
  eliminado timestamp with time zone
);

CREATE TABLE public.despachos_pedidos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  despacho_id uuid,
  pedido_id uuid,
  estado_entrega character varying(20) DEFAULT 'pendiente'::character varying,
  notas_entrega text,
  creado_en timestamp with time zone DEFAULT now()
);

CREATE TABLE public.metodos_pago (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre character varying(50) NOT NULL,
  codigo_dian character varying(3) DEFAULT '10'::character varying NOT NULL,
  es_efectivo boolean DEFAULT false NOT NULL,
  estado boolean DEFAULT true,
  creado timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  actualizado timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  eliminado timestamp with time zone
);

CREATE TABLE public.municipios (
  id integer DEFAULT nextval('municipios_id_seq'::regclass) NOT NULL,
  nombre character varying(100) NOT NULL,
  departamento character varying(100) NOT NULL,
  estado boolean DEFAULT true,
  creado timestamp with time zone DEFAULT now(),
  actualizado timestamp with time zone DEFAULT now(),
  eliminado timestamp with time zone,
  codigo character varying(10),
  codigo_departamento character varying(10)
);

CREATE TABLE public.pagos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  pedido_id uuid,
  compra_id uuid,
  metodo_pago_id uuid NOT NULL,
  tipo character varying(20) NOT NULL,
  monto numeric(12,2) NOT NULL,
  registrado_por uuid DEFAULT auth.uid(),
  creado timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);

CREATE TABLE public.pedidos_cabecera (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  numero_pedido character varying(50) NOT NULL,
  fecha_pedido timestamp with time zone DEFAULT now(),
  cliente_id uuid NOT NULL,
  vendedor_id uuid NOT NULL,
  estado character varying(30) DEFAULT 'pendiente'::character varying,
  total numeric(12,2) DEFAULT 0.00,
  notas text,
  estado_registro boolean DEFAULT true,
  creado timestamp with time zone DEFAULT now(),
  actualizado timestamp with time zone,
  eliminado timestamp with time zone,
  fecha_entrega timestamp with time zone,
  ingefact_factura_id uuid,
  ingefact_numero_factura character varying(50),
  ingefact_enviado_en timestamp with time zone,
  total_pagado numeric(12,2) DEFAULT 0 NOT NULL
);

CREATE TABLE public.pedidos_detalle (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  pedido_id uuid NOT NULL,
  producto_id uuid NOT NULL,
  cantidad numeric(12,2) NOT NULL,
  precio_unitario numeric(12,2) NOT NULL,
  iva_porcentaje numeric(5,2) DEFAULT 0,
  inc_porcentaje numeric(5,2) DEFAULT 0,
  subtotal_linea numeric(12,2) NOT NULL,
  creado timestamp with time zone DEFAULT now(),
  actualizado timestamp with time zone,
  tipo_precio character varying(20) DEFAULT 'normal'::character varying NOT NULL,
  tipo_precio_id uuid
);

CREATE TABLE public.perfiles (
  id uuid NOT NULL,
  nombre_usuario character varying(50) NOT NULL,
  nombre_completo character varying(100) NOT NULL,
  rol_id integer,
  estado boolean DEFAULT true NOT NULL,
  creado timestamp with time zone DEFAULT now() NOT NULL,
  actualizado timestamp with time zone DEFAULT now() NOT NULL,
  eliminado timestamp with time zone,
  correo character varying(255)
);

CREATE TABLE public.productos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  codigo character varying(50) NOT NULL,
  codigo_barra character varying(100),
  nombre character varying(150) NOT NULL,
  descripcion text,
  tipo character varying(50),
  departamento character varying(100),
  linea character varying(100),
  precio_venta numeric(12,2) NOT NULL,
  iva numeric(5,2) DEFAULT 0 NOT NULL,
  inc numeric(5,2) DEFAULT 0 NOT NULL,
  clasificacion character varying(20) NOT NULL,
  disponible numeric(12,2) DEFAULT 0 NOT NULL,
  estado boolean DEFAULT true,
  creado timestamp with time zone DEFAULT now(),
  actualizado timestamp with time zone DEFAULT now(),
  eliminado timestamp with time zone,
  categoria character varying(100),
  ultimo_costo numeric(12,2)
);

CREATE TABLE public.productos_precios (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  producto_id uuid NOT NULL,
  tipo_precio_id uuid NOT NULL,
  precio numeric(12,2) NOT NULL,
  estado boolean DEFAULT true,
  creado timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  actualizado timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  eliminado timestamp with time zone
);

CREATE TABLE public.productos_precios_mayoristas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  producto_id uuid NOT NULL,
  cantidad_minima integer NOT NULL,
  precio numeric(12,2) NOT NULL,
  estado boolean DEFAULT true,
  creado timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  actualizado timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  eliminado timestamp with time zone
);

CREATE TABLE public.proveedores (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  numero_identificacion character varying(50) NOT NULL,
  nombre_comercial character varying(255) NOT NULL,
  contacto_nombre character varying(150),
  telefono character varying(50),
  correo character varying(150),
  direccion text,
  estado boolean DEFAULT true,
  creado timestamp with time zone DEFAULT now(),
  actualizado timestamp with time zone DEFAULT now(),
  eliminado timestamp with time zone
);

CREATE TABLE public.roles (
  id integer DEFAULT nextval('roles_id_seq'::regclass) NOT NULL,
  nombre character varying(50) NOT NULL,
  permisos jsonb DEFAULT '[]'::jsonb,
  estado boolean DEFAULT true NOT NULL,
  creado timestamp with time zone DEFAULT now() NOT NULL,
  actualizado timestamp with time zone DEFAULT now() NOT NULL,
  eliminado timestamp with time zone
);

CREATE TABLE public.tipos_identificacion (
  id integer DEFAULT nextval('tipos_identificacion_id_seq'::regclass) NOT NULL,
  codigo character varying(10) NOT NULL,
  descripcion character varying(100) NOT NULL,
  aplica_natural boolean DEFAULT true,
  aplica_juridica boolean DEFAULT false,
  estado boolean DEFAULT true,
  creado timestamp with time zone DEFAULT now(),
  actualizado timestamp with time zone DEFAULT now(),
  eliminado timestamp with time zone
);

CREATE TABLE public.tipos_precio (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre character varying(50) NOT NULL,
  roles_permitidos text[] NOT NULL,
  estado boolean DEFAULT true,
  creado timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  actualizado timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  eliminado timestamp with time zone
);

CREATE TABLE public.vehiculos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  placa character varying(20) NOT NULL,
  marca character varying(50),
  modelo integer,
  capacidad_peso numeric(10,2) NOT NULL,
  capacidad_volumen numeric(10,2) DEFAULT 0,
  estado boolean DEFAULT true,
  creado timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  actualizado timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  eliminado timestamp with time zone,
  conductor_id uuid
);

ALTER SEQUENCE public.auditoria_id_seq OWNED BY public.auditoria.id;
ALTER SEQUENCE public.municipios_id_seq OWNED BY public.municipios.id;
ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;
ALTER SEQUENCE public.tipos_identificacion_id_seq OWNED BY public.tipos_identificacion.id;

-- ----------------------------------------------------------------------------
-- Claves primarias
-- ----------------------------------------------------------------------------
ALTER TABLE ONLY public.auditoria ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.auth_intentos_fallidos ADD CONSTRAINT auth_intentos_fallidos_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.clientes ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.compras_cabecera ADD CONSTRAINT compras_cabecera_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.compras_detalle ADD CONSTRAINT compras_detalle_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.configuracion_sistema ADD CONSTRAINT configuracion_sistema_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.despachos ADD CONSTRAINT despachos_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.despachos_pedidos ADD CONSTRAINT despachos_pedidos_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.metodos_pago ADD CONSTRAINT metodos_pago_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.municipios ADD CONSTRAINT municipios_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pagos ADD CONSTRAINT pagos_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pedidos_cabecera ADD CONSTRAINT pedidos_cabecera_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pedidos_detalle ADD CONSTRAINT pedidos_detalle_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.perfiles ADD CONSTRAINT perfiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.productos ADD CONSTRAINT productos_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.productos_precios ADD CONSTRAINT productos_precios_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.productos_precios_mayoristas ADD CONSTRAINT productos_precios_mayoristas_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.proveedores ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.roles ADD CONSTRAINT roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tipos_identificacion ADD CONSTRAINT tipos_identificacion_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tipos_precio ADD CONSTRAINT tipos_precio_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.vehiculos ADD CONSTRAINT vehiculos_pkey PRIMARY KEY (id);

-- ----------------------------------------------------------------------------
-- Restricciones únicas
-- ----------------------------------------------------------------------------
ALTER TABLE ONLY public.clientes ADD CONSTRAINT clientes_numero_identificacion_key UNIQUE (numero_identificacion);
ALTER TABLE ONLY public.despachos ADD CONSTRAINT despachos_codigo_despacho_key UNIQUE (codigo_despacho);
ALTER TABLE ONLY public.despachos_pedidos ADD CONSTRAINT despachos_pedidos_despacho_id_pedido_id_key UNIQUE (despacho_id, pedido_id);
ALTER TABLE ONLY public.pedidos_cabecera ADD CONSTRAINT pedidos_cabecera_numero_pedido_key UNIQUE (numero_pedido);
ALTER TABLE ONLY public.perfiles ADD CONSTRAINT perfiles_nombre_usuario_key UNIQUE (nombre_usuario);
ALTER TABLE ONLY public.productos ADD CONSTRAINT productos_codigo_key UNIQUE (codigo);
ALTER TABLE ONLY public.proveedores ADD CONSTRAINT proveedores_numero_identificacion_key UNIQUE (numero_identificacion);
ALTER TABLE ONLY public.roles ADD CONSTRAINT roles_nombre_key UNIQUE (nombre);
ALTER TABLE ONLY public.tipos_identificacion ADD CONSTRAINT tipos_identificacion_codigo_key UNIQUE (codigo);
ALTER TABLE ONLY public.vehiculos ADD CONSTRAINT vehiculos_placa_key UNIQUE (placa);

-- ----------------------------------------------------------------------------
-- Restricciones CHECK
-- ----------------------------------------------------------------------------
ALTER TABLE ONLY public.clientes ADD CONSTRAINT clientes_tipo_organizacion_check CHECK (((tipo_organizacion)::text = ANY ((ARRAY['natural'::character varying, 'juridica'::character varying])::text[])));
ALTER TABLE ONLY public.compras_cabecera ADD CONSTRAINT compras_cabecera_estado_check CHECK (((estado)::text = ANY ((ARRAY['registrada'::character varying, 'anulada'::character varying])::text[])));
ALTER TABLE ONLY public.compras_detalle ADD CONSTRAINT compras_detalle_cantidad_check CHECK ((cantidad > (0)::numeric));
ALTER TABLE ONLY public.compras_detalle ADD CONSTRAINT compras_detalle_costo_check CHECK ((costo_unitario >= (0)::numeric));
ALTER TABLE ONLY public.configuracion_sistema ADD CONSTRAINT configuracion_sistema_id_check CHECK (id);
ALTER TABLE ONLY public.despachos ADD CONSTRAINT despachos_estado_check CHECK (((estado)::text = ANY ((ARRAY['creado'::character varying, 'en_ruta'::character varying, 'completado'::character varying, 'anulado'::character varying])::text[])));
ALTER TABLE ONLY public.despachos_pedidos ADD CONSTRAINT despachos_pedidos_estado_entrega_check CHECK (((estado_entrega)::text = ANY ((ARRAY['pendiente'::character varying, 'entregado'::character varying, 'rechazado'::character varying])::text[])));
ALTER TABLE ONLY public.metodos_pago ADD CONSTRAINT metodos_pago_codigo_dian_check CHECK (((length((codigo_dian)::text) >= 2) AND (length((codigo_dian)::text) <= 3)));
ALTER TABLE ONLY public.metodos_pago ADD CONSTRAINT metodos_pago_nombre_check CHECK ((length(btrim((nombre)::text)) > 0));
ALTER TABLE ONLY public.pagos ADD CONSTRAINT pagos_monto_check CHECK ((monto > (0)::numeric));
ALTER TABLE ONLY public.pagos ADD CONSTRAINT pagos_tipo_segun_origen CHECK ((((pedido_id IS NOT NULL) AND ((tipo)::text = ANY ((ARRAY['abono'::character varying, 'entrega'::character varying, 'devolucion'::character varying])::text[]))) OR ((compra_id IS NOT NULL) AND ((tipo)::text = ANY ((ARRAY['pago'::character varying, 'abono'::character varying, 'devolucion'::character varying])::text[])))));
ALTER TABLE ONLY public.pagos ADD CONSTRAINT pagos_un_solo_origen CHECK (((pedido_id IS NOT NULL) <> (compra_id IS NOT NULL)));
ALTER TABLE ONLY public.pedidos_detalle ADD CONSTRAINT chk_pedidos_detalle_tipo_precio CHECK ((((tipo_precio)::text = ANY ((ARRAY['normal'::character varying, 'mayorista'::character varying, 'personalizado'::character varying])::text[])) AND (((tipo_precio)::text = 'personalizado'::text) = (tipo_precio_id IS NOT NULL))));
ALTER TABLE ONLY public.pedidos_detalle ADD CONSTRAINT pedidos_detalle_cantidad_check CHECK ((cantidad > (0)::numeric));
ALTER TABLE ONLY public.pedidos_detalle ADD CONSTRAINT pedidos_detalle_cantidad_fraccion_check CHECK ((mod(((cantidad * (100)::numeric))::integer, 25) = 0));
ALTER TABLE ONLY public.productos ADD CONSTRAINT productos_clasificacion_check CHECK (((clasificacion)::text = ANY ((ARRAY['gravado'::character varying, 'exento'::character varying, 'excluido'::character varying])::text[])));
ALTER TABLE ONLY public.productos ADD CONSTRAINT productos_inc_check CHECK ((inc >= (0)::numeric));
ALTER TABLE ONLY public.productos ADD CONSTRAINT productos_iva_check CHECK ((iva >= (0)::numeric));
ALTER TABLE ONLY public.productos ADD CONSTRAINT productos_precio_venta_check CHECK ((precio_venta >= (0)::numeric));
ALTER TABLE ONLY public.productos_precios ADD CONSTRAINT productos_precios_precio_check CHECK ((precio >= (0)::numeric));
ALTER TABLE ONLY public.productos_precios_mayoristas ADD CONSTRAINT productos_precios_mayoristas_cantidad_minima_check CHECK ((cantidad_minima > 0));
ALTER TABLE ONLY public.productos_precios_mayoristas ADD CONSTRAINT productos_precios_mayoristas_precio_check CHECK ((precio >= (0)::numeric));
ALTER TABLE ONLY public.tipos_precio ADD CONSTRAINT tipos_precio_nombre_check CHECK ((length(btrim((nombre)::text)) > 0));
ALTER TABLE ONLY public.tipos_precio ADD CONSTRAINT tipos_precio_roles_permitidos_check CHECK (((cardinality(roles_permitidos) > 0) AND (roles_permitidos <@ ARRAY['soporte'::text, 'gerencia'::text, 'vendedor'::text, 'despachador'::text, 'cajera'::text])));

-- ----------------------------------------------------------------------------
-- Claves foráneas
-- ----------------------------------------------------------------------------
ALTER TABLE ONLY public.auditoria ADD CONSTRAINT auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.compras_cabecera ADD CONSTRAINT compras_cabecera_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);
ALTER TABLE ONLY public.compras_cabecera ADD CONSTRAINT compras_cabecera_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.perfiles(id);
ALTER TABLE ONLY public.compras_detalle ADD CONSTRAINT compras_detalle_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras_cabecera(id);
ALTER TABLE ONLY public.compras_detalle ADD CONSTRAINT compras_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);
ALTER TABLE ONLY public.despachos ADD CONSTRAINT despachos_repartidor_id_fkey FOREIGN KEY (repartidor_id) REFERENCES public.perfiles(id);
ALTER TABLE ONLY public.despachos ADD CONSTRAINT despachos_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id);
ALTER TABLE ONLY public.despachos_pedidos ADD CONSTRAINT despachos_pedidos_despacho_id_fkey FOREIGN KEY (despacho_id) REFERENCES public.despachos(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.despachos_pedidos ADD CONSTRAINT despachos_pedidos_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos_cabecera(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.pagos ADD CONSTRAINT pagos_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras_cabecera(id);
ALTER TABLE ONLY public.pagos ADD CONSTRAINT pagos_metodo_pago_id_fkey FOREIGN KEY (metodo_pago_id) REFERENCES public.metodos_pago(id);
ALTER TABLE ONLY public.pagos ADD CONSTRAINT pagos_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos_cabecera(id);
ALTER TABLE ONLY public.pagos ADD CONSTRAINT pagos_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.perfiles(id);
ALTER TABLE ONLY public.pedidos_cabecera ADD CONSTRAINT pedidos_cabecera_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.pedidos_cabecera ADD CONSTRAINT pedidos_cabecera_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES public.perfiles(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.pedidos_detalle ADD CONSTRAINT pedidos_detalle_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos_cabecera(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pedidos_detalle ADD CONSTRAINT pedidos_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.pedidos_detalle ADD CONSTRAINT pedidos_detalle_tipo_precio_id_fkey FOREIGN KEY (tipo_precio_id) REFERENCES public.tipos_precio(id);
ALTER TABLE ONLY public.perfiles ADD CONSTRAINT perfiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.perfiles ADD CONSTRAINT perfiles_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.productos_precios ADD CONSTRAINT productos_precios_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.productos_precios ADD CONSTRAINT productos_precios_tipo_precio_id_fkey FOREIGN KEY (tipo_precio_id) REFERENCES public.tipos_precio(id);
ALTER TABLE ONLY public.productos_precios_mayoristas ADD CONSTRAINT productos_precios_mayoristas_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.vehiculos ADD CONSTRAINT vehiculos_conductor_id_fkey FOREIGN KEY (conductor_id) REFERENCES public.perfiles(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- Índices (los de restricciones PK/UNIQUE ya se crearon arriba)
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX metodos_pago_efectivo_key ON public.metodos_pago USING btree (es_efectivo) WHERE es_efectivo;
CREATE UNIQUE INDEX metodos_pago_nombre_key ON public.metodos_pago USING btree (lower((nombre)::text)) WHERE (eliminado IS NULL);
CREATE INDEX pagos_compra_id_idx ON public.pagos USING btree (compra_id) WHERE (compra_id IS NOT NULL);
CREATE INDEX pagos_metodo_pago_id_idx ON public.pagos USING btree (metodo_pago_id);
CREATE INDEX pagos_pedido_id_idx ON public.pagos USING btree (pedido_id) WHERE (pedido_id IS NOT NULL);
CREATE INDEX pedidos_detalle_tipo_precio_id_idx ON public.pedidos_detalle USING btree (tipo_precio_id);
CREATE INDEX productos_precios_tipo_precio_id_idx ON public.productos_precios USING btree (tipo_precio_id);
CREATE UNIQUE INDEX productos_precios_producto_tipo_key ON public.productos_precios USING btree (producto_id, tipo_precio_id) WHERE (eliminado IS NULL);
CREATE UNIQUE INDEX productos_precios_mayoristas_producto_cantidad_key ON public.productos_precios_mayoristas USING btree (producto_id, cantidad_minima) WHERE (eliminado IS NULL);
CREATE UNIQUE INDEX tipos_precio_nombre_key ON public.tipos_precio USING btree (lower((nombre)::text)) WHERE (eliminado IS NULL);
CREATE INDEX idx_vehiculos_conductor ON public.vehiculos USING btree (conductor_id);
CREATE INDEX idx_vehiculos_estado ON public.vehiculos USING btree (estado) WHERE (eliminado IS NULL);
CREATE INDEX idx_vehiculos_placa ON public.vehiculos USING btree (placa);

-- ----------------------------------------------------------------------------
-- Comentarios
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.auth_intentos_fallidos IS 'Estado efímero de intentos fallidos de login por usuario, leído y escrito por el Password Verification Hook. No es una tabla de dominio: no sigue el patrón estado/creado/actualizado/eliminado.';
COMMENT ON COLUMN public.clientes.ingefact_cliente_id IS 'ID del cliente ya creado en IngeFact (empresa_id propio de IngeFact). NULL = aún no se ha facturado a este cliente.';
COMMENT ON COLUMN public.pedidos_cabecera.ingefact_enviado_en IS 'Fecha/hora en que se envió la factura a IngeFact.';
COMMENT ON COLUMN public.pedidos_cabecera.ingefact_factura_id IS 'ID de la factura en IngeFact una vez enviada a la DIAN. NULL = pedido aún no facturado.';
COMMENT ON COLUMN public.pedidos_cabecera.ingefact_numero_factura IS 'Número completo de la factura (prefijo + consecutivo) devuelto por IngeFact, solo para mostrar en el detalle del pedido.';
