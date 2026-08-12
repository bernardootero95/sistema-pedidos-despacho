


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."actualizar_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.actualizado = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."actualizar_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bloquear_autoescalada_privilegios"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."bloquear_autoescalada_privilegios"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_despacho_transaccional"("p_vehiculo_id" "uuid", "p_repartidor_id" "uuid", "p_fecha_despacho" timestamp with time zone, "p_notas" "text", "p_pedidos_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_pedido RECORD;
  v_despacho_id UUID;
  v_codigo_despacho TEXT;
  v_siguiente_numero INTEGER;
BEGIN
  IF p_vehiculo_id IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar un vehículo.';
  END IF;

  IF p_repartidor_id IS NULL THEN
    RAISE EXCEPTION 'Debe asignar un conductor/repartidor.';
  END IF;

  IF p_pedidos_ids IS NULL OR array_length(p_pedidos_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debe asignar al menos un pedido a la ruta.';
  END IF;

  -- 1. Bloquear y validar cada pedido (evita doble asignación concurrente
  --    por dos despachadores trabajando al mismo tiempo)
  FOR v_pedido IN
    SELECT id, numero_pedido, estado
      FROM pedidos_cabecera
      WHERE id = ANY(p_pedidos_ids)
        AND eliminado IS NULL
      ORDER BY id
      FOR UPDATE
  LOOP
    IF v_pedido.estado <> 'pendiente' THEN
      RAISE EXCEPTION 'El pedido % ya no está pendiente (estado actual: %). Puede que otro despachador ya lo haya asignado.',
        v_pedido.numero_pedido, v_pedido.estado;
    END IF;
  END LOOP;

  -- Verificar que todos los IDs enviados existan (evita ids "fantasma")
  IF (SELECT COUNT(*) FROM pedidos_cabecera WHERE id = ANY(p_pedidos_ids) AND eliminado IS NULL)
     <> array_length(p_pedidos_ids, 1) THEN
    RAISE EXCEPTION 'Uno o más pedidos seleccionados ya no existen o fueron eliminados.';
  END IF;

  -- 2. Generar consecutivo del despacho (DSP-0001, DSP-0002, ...)
  SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo_despacho, '\D', '', 'g'), '')::INTEGER), 0) + 1
    INTO v_siguiente_numero
    FROM despachos;

  v_codigo_despacho := 'DSP-' || LPAD(v_siguiente_numero::TEXT, 4, '0');

  -- 3. Insertar cabecera del despacho
  INSERT INTO despachos (
    codigo_despacho, vehiculo_id, repartidor_id, fecha_despacho, notas, estado
  ) VALUES (
    v_codigo_despacho, p_vehiculo_id, p_repartidor_id, p_fecha_despacho, p_notas, 'creado'
  )
  RETURNING id INTO v_despacho_id;

  -- 4. Insertar el detalle (pedidos asignados a la ruta)
  INSERT INTO despachos_pedidos (despacho_id, pedido_id, estado_entrega)
  SELECT v_despacho_id, unnest(p_pedidos_ids), 'pendiente';

  -- 5. Marcar los pedidos como despachados
  UPDATE pedidos_cabecera
    SET estado = 'despachado', actualizado = NOW()
    WHERE id = ANY(p_pedidos_ids);

  RETURN jsonb_build_object(
    'id', v_despacho_id,
    'codigo_despacho', v_codigo_despacho
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;


ALTER FUNCTION "public"."crear_despacho_transaccional"("p_vehiculo_id" "uuid", "p_repartidor_id" "uuid", "p_fecha_despacho" timestamp with time zone, "p_notas" "text", "p_pedidos_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_pedido_transaccional"("p_cliente_id" "uuid", "p_vendedor_id" "uuid", "p_notas" "text", "p_detalles" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  v_item JSONB;
  v_producto RECORD;
  v_cantidad INTEGER;
  v_precio NUMERIC;
  v_subtotal_linea NUMERIC;
  v_total NUMERIC := 0;
  v_numero_pedido TEXT;
  v_pedido_id UUID;
  v_detalles_insertar JSONB := '[]'::JSONB;
BEGIN
  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;

  -- 1. Bloquear y validar cada producto (orden por id evita deadlocks entre
  --    transacciones concurrentes que compran los mismos productos).
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_detalles)
    ORDER BY (value->>'producto_id')
  LOOP
    v_cantidad := (v_item->>'cantidad')::INTEGER;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', v_item->>'producto_id';
    END IF;

    SELECT id, nombre, disponible, precio_venta, iva, inc
      INTO v_producto
      FROM productos
      WHERE id = (v_item->>'producto_id')::UUID
        AND eliminado IS NULL
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto % no existe o fue eliminado.', v_item->>'producto_id';
    END IF;

    IF v_producto.disponible < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %', v_producto.nombre, v_producto.disponible;
    END IF;

    v_precio := v_producto.precio_venta;
    v_subtotal_linea := v_precio * v_cantidad;
    v_total := v_total + v_subtotal_linea;

    v_detalles_insertar := v_detalles_insertar || jsonb_build_object(
      'producto_id', v_producto.id,
      'cantidad', v_cantidad,
      'precio_unitario', v_precio,
      'iva_porcentaje', COALESCE(v_producto.iva, 0),
      'inc_porcentaje', COALESCE(v_producto.inc, 0),
      'subtotal_linea', v_subtotal_linea
    );

    -- Descontar stock inmediatamente (fila ya bloqueada con FOR UPDATE)
    UPDATE productos
      SET disponible = disponible - v_cantidad,
          actualizado = NOW()
      WHERE id = v_producto.id;
  END LOOP;

  -- 2. Generar consecutivo de forma segura dentro de la transacción
  SELECT COALESCE(MAX(numero_pedido::INTEGER), 0) + 1
    INTO v_numero_pedido
    FROM pedidos_cabecera
    WHERE numero_pedido ~ '^[0-9]+$';

  IF v_numero_pedido IS NULL THEN
    v_numero_pedido := '1';
  END IF;

  -- 3. Insertar cabecera
  INSERT INTO pedidos_cabecera (cliente_id, vendedor_id, notas, total, numero_pedido, estado)
  VALUES (p_cliente_id, p_vendedor_id, p_notas, v_total, v_numero_pedido, 'pendiente')
  RETURNING id INTO v_pedido_id;

  -- 4. Insertar detalles
  INSERT INTO pedidos_detalle (
    pedido_id, producto_id, cantidad, precio_unitario,
    iva_porcentaje, inc_porcentaje, subtotal_linea
  )
  SELECT
    v_pedido_id,
    (d->>'producto_id')::UUID,
    (d->>'cantidad')::INTEGER,
    (d->>'precio_unitario')::NUMERIC,
    (d->>'iva_porcentaje')::NUMERIC,
    (d->>'inc_porcentaje')::NUMERIC,
    (d->>'subtotal_linea')::NUMERIC
  FROM jsonb_array_elements(v_detalles_insertar) AS d;

  RETURN jsonb_build_object(
    'id', v_pedido_id,
    'numero_pedido', v_numero_pedido,
    'total', v_total
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Cualquier error revierte automáticamente toda la función (stock, cabecera, detalle)
    RAISE;
END;
$_$;


ALTER FUNCTION "public"."crear_pedido_transaccional"("p_cliente_id" "uuid", "p_vendedor_id" "uuid", "p_notas" "text", "p_detalles" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obtener_rol_actual"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT r.nombre
  FROM perfiles p
  JOIN roles r ON r.id = p.rol_id
  WHERE p.id = auth.uid()
    AND p.estado = true
    AND p.eliminado IS NULL
  LIMIT 1;
$$;


ALTER FUNCTION "public"."obtener_rol_actual"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_auditoria"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    usr_id UUID;
BEGIN
    -- Intentar obtener el ID del usuario autenticado en Supabase Auth
    usr_id := auth.uid();
    
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO auditoria (tabla, operacion, registro_id, datos_nuevos, usuario_id)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id::text, to_jsonb(NEW), usr_id);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Evitar auditar si es un borrado lógico idéntico sin cambios
        IF NEW != OLD THEN
            INSERT INTO auditoria (tabla, operacion, registro_id, datos_anteriores, datos_nuevos, usuario_id)
            VALUES (TG_TABLE_NAME, TG_OP, NEW.id::text, to_jsonb(OLD), to_jsonb(NEW), usr_id);
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO auditoria (tabla, operacion, registro_id, datos_anteriores, usuario_id)
        VALUES (TG_TABLE_NAME, TG_OP, OLD.id::text, to_jsonb(OLD), usr_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."registrar_auditoria"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_user_status"("p_user_id" "uuid", "p_new_status" boolean) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result JSON;
BEGIN
  IF obtener_rol_actual() NOT IN ('gerencia', 'soporte') THEN
    RAISE EXCEPTION 'No tienes permiso para activar/desactivar usuarios.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio estado de acceso.';
  END IF;

  UPDATE public.perfiles
  SET estado = p_new_status
  WHERE id = p_user_id
  RETURNING row_to_json(perfiles.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."toggle_user_status"("p_user_id" "uuid", "p_new_status" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_vehiculos_modtime"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.actualizado = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_vehiculos_modtime"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."auditoria" (
    "id" bigint NOT NULL,
    "tabla" character varying(50) NOT NULL,
    "operacion" character varying(10) NOT NULL,
    "registro_id" character varying(50) NOT NULL,
    "datos_anteriores" "jsonb",
    "datos_nuevos" "jsonb",
    "usuario_id" "uuid",
    "creado" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."auditoria" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."auditoria_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."auditoria_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."auditoria_id_seq" OWNED BY "public"."auditoria"."id";



CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_identificacion" character varying(50) NOT NULL,
    "tipo_identificacion" character varying(20) NOT NULL,
    "tipo_organizacion" character varying(20) NOT NULL,
    "primer_nombre" character varying(100),
    "otros_nombres" character varying(100),
    "primer_apellido" character varying(100),
    "otros_apellidos" character varying(100),
    "razon_social" character varying(255),
    "nombre_comercial" character varying(255),
    "direccion" "text" NOT NULL,
    "ciudad_municipio" character varying(100) NOT NULL,
    "correo" character varying(150),
    "telefono" character varying(50),
    "estado" boolean DEFAULT true,
    "creado" timestamp with time zone DEFAULT "now"(),
    "actualizado" timestamp with time zone DEFAULT "now"(),
    "eliminado" timestamp with time zone,
    "codigo_municipio" character varying(10),
    "digito_verificacion" character varying(1),
    CONSTRAINT "clientes_tipo_organizacion_check" CHECK ((("tipo_organizacion")::"text" = ANY ((ARRAY['natural'::character varying, 'juridica'::character varying])::"text"[])))
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."despachos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo_despacho" character varying(20) NOT NULL,
    "vehiculo_id" "uuid" NOT NULL,
    "repartidor_id" "uuid" NOT NULL,
    "estado" character varying(20) DEFAULT 'creado'::character varying,
    "fecha_despacho" timestamp with time zone DEFAULT "now"(),
    "notas" "text",
    "creado_en" timestamp with time zone DEFAULT "now"(),
    "actualizado_en" timestamp with time zone DEFAULT "now"(),
    "eliminado" timestamp with time zone,
    CONSTRAINT "despachos_estado_check" CHECK ((("estado")::"text" = ANY ((ARRAY['creado'::character varying, 'en_ruta'::character varying, 'completado'::character varying, 'anulado'::character varying])::"text"[])))
);


ALTER TABLE "public"."despachos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."despachos_pedidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "despacho_id" "uuid",
    "pedido_id" "uuid",
    "estado_entrega" character varying(20) DEFAULT 'pendiente'::character varying,
    "notas_entrega" "text",
    "creado_en" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "despachos_pedidos_estado_entrega_check" CHECK ((("estado_entrega")::"text" = ANY ((ARRAY['pendiente'::character varying, 'entregado'::character varying, 'rechazado'::character varying])::"text"[])))
);


ALTER TABLE "public"."despachos_pedidos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."municipios" (
    "id" integer NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "departamento" character varying(100) NOT NULL,
    "estado" boolean DEFAULT true,
    "creado" timestamp with time zone DEFAULT "now"(),
    "actualizado" timestamp with time zone DEFAULT "now"(),
    "eliminado" timestamp with time zone,
    "codigo" character varying(10),
    "codigo_departamento" character varying(10)
);


ALTER TABLE "public"."municipios" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."municipios_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."municipios_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."municipios_id_seq" OWNED BY "public"."municipios"."id";



CREATE TABLE IF NOT EXISTS "public"."pedidos_cabecera" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_pedido" character varying(50) NOT NULL,
    "fecha_pedido" timestamp with time zone DEFAULT "now"(),
    "cliente_id" "uuid" NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "estado" character varying(30) DEFAULT 'pendiente'::character varying,
    "total" numeric(12,2) DEFAULT 0.00,
    "notas" "text",
    "estado_registro" boolean DEFAULT true,
    "creado" timestamp with time zone DEFAULT "now"(),
    "actualizado" timestamp with time zone,
    "eliminado" timestamp with time zone
);


ALTER TABLE "public"."pedidos_cabecera" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pedidos_detalle" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "cantidad" integer NOT NULL,
    "precio_unitario" numeric(12,2) NOT NULL,
    "iva_porcentaje" numeric(5,2) DEFAULT 0,
    "inc_porcentaje" numeric(5,2) DEFAULT 0,
    "subtotal_linea" numeric(12,2) NOT NULL,
    "creado" timestamp with time zone DEFAULT "now"(),
    "actualizado" timestamp with time zone,
    CONSTRAINT "pedidos_detalle_cantidad_check" CHECK (("cantidad" > 0))
);


ALTER TABLE "public"."pedidos_detalle" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."perfiles" (
    "id" "uuid" NOT NULL,
    "nombre_usuario" character varying(50) NOT NULL,
    "nombre_completo" character varying(100) NOT NULL,
    "rol_id" integer,
    "estado" boolean DEFAULT true NOT NULL,
    "creado" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eliminado" timestamp with time zone
);


ALTER TABLE "public"."perfiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" character varying(50) NOT NULL,
    "codigo_barra" character varying(100),
    "nombre" character varying(150) NOT NULL,
    "descripcion" "text",
    "tipo" character varying(50),
    "departamento" character varying(100),
    "linea" character varying(100),
    "precio_venta" numeric(12,2) NOT NULL,
    "iva" numeric(5,2) DEFAULT 0 NOT NULL,
    "inc" numeric(5,2) DEFAULT 0 NOT NULL,
    "clasificacion" character varying(20) NOT NULL,
    "disponible" integer DEFAULT 0 NOT NULL,
    "estado" boolean DEFAULT true,
    "creado" timestamp with time zone DEFAULT "now"(),
    "actualizado" timestamp with time zone DEFAULT "now"(),
    "eliminado" timestamp with time zone,
    "categoria" character varying(100),
    CONSTRAINT "productos_clasificacion_check" CHECK ((("clasificacion")::"text" = ANY ((ARRAY['gravado'::character varying, 'exento'::character varying, 'excluido'::character varying])::"text"[]))),
    CONSTRAINT "productos_inc_check" CHECK (("inc" >= (0)::numeric)),
    CONSTRAINT "productos_iva_check" CHECK (("iva" >= (0)::numeric)),
    CONSTRAINT "productos_precio_venta_check" CHECK (("precio_venta" >= (0)::numeric))
);


ALTER TABLE "public"."productos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" integer NOT NULL,
    "nombre" character varying(50) NOT NULL,
    "permisos" "jsonb" DEFAULT '[]'::"jsonb",
    "estado" boolean DEFAULT true NOT NULL,
    "creado" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eliminado" timestamp with time zone
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."roles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."roles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."roles_id_seq" OWNED BY "public"."roles"."id";



CREATE TABLE IF NOT EXISTS "public"."tipos_identificacion" (
    "id" integer NOT NULL,
    "codigo" character varying(10) NOT NULL,
    "descripcion" character varying(100) NOT NULL,
    "aplica_natural" boolean DEFAULT true,
    "aplica_juridica" boolean DEFAULT false,
    "estado" boolean DEFAULT true,
    "creado" timestamp with time zone DEFAULT "now"(),
    "actualizado" timestamp with time zone DEFAULT "now"(),
    "eliminado" timestamp with time zone
);


ALTER TABLE "public"."tipos_identificacion" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tipos_identificacion_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tipos_identificacion_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tipos_identificacion_id_seq" OWNED BY "public"."tipos_identificacion"."id";



CREATE TABLE IF NOT EXISTS "public"."vehiculos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "placa" character varying(20) NOT NULL,
    "marca" character varying(50) NOT NULL,
    "modelo" integer NOT NULL,
    "capacidad_peso" numeric(10,2) NOT NULL,
    "capacidad_volumen" numeric(10,2) DEFAULT 0,
    "estado" boolean DEFAULT true,
    "creado" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "actualizado" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "eliminado" timestamp with time zone,
    "conductor_id" "uuid"
);


ALTER TABLE "public"."vehiculos" OWNER TO "postgres";


ALTER TABLE ONLY "public"."auditoria" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."auditoria_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."municipios" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."municipios_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tipos_identificacion" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tipos_identificacion_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."auditoria"
    ADD CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_numero_identificacion_key" UNIQUE ("numero_identificacion");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."despachos"
    ADD CONSTRAINT "despachos_codigo_despacho_key" UNIQUE ("codigo_despacho");



ALTER TABLE ONLY "public"."despachos_pedidos"
    ADD CONSTRAINT "despachos_pedidos_despacho_id_pedido_id_key" UNIQUE ("despacho_id", "pedido_id");



ALTER TABLE ONLY "public"."despachos_pedidos"
    ADD CONSTRAINT "despachos_pedidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."despachos"
    ADD CONSTRAINT "despachos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."municipios"
    ADD CONSTRAINT "municipios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pedidos_cabecera"
    ADD CONSTRAINT "pedidos_cabecera_numero_pedido_key" UNIQUE ("numero_pedido");



ALTER TABLE ONLY "public"."pedidos_cabecera"
    ADD CONSTRAINT "pedidos_cabecera_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pedidos_detalle"
    ADD CONSTRAINT "pedidos_detalle_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_nombre_usuario_key" UNIQUE ("nombre_usuario");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tipos_identificacion"
    ADD CONSTRAINT "tipos_identificacion_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."tipos_identificacion"
    ADD CONSTRAINT "tipos_identificacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehiculos"
    ADD CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehiculos"
    ADD CONSTRAINT "vehiculos_placa_key" UNIQUE ("placa");



CREATE INDEX "idx_vehiculos_conductor" ON "public"."vehiculos" USING "btree" ("conductor_id");



CREATE INDEX "idx_vehiculos_estado" ON "public"."vehiculos" USING "btree" ("estado") WHERE ("eliminado" IS NULL);



CREATE INDEX "idx_vehiculos_placa" ON "public"."vehiculos" USING "btree" ("placa");



CREATE OR REPLACE TRIGGER "audit_perfiles" AFTER INSERT OR DELETE OR UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_auditoria"();



CREATE OR REPLACE TRIGGER "audit_roles" AFTER INSERT OR DELETE OR UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_auditoria"();



CREATE OR REPLACE TRIGGER "set_timestamp_perfiles" BEFORE UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_roles" BEFORE UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp"();



CREATE OR REPLACE TRIGGER "trg_bloquear_autoescalada" BEFORE UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."bloquear_autoescalada_privilegios"();



CREATE OR REPLACE TRIGGER "update_vehiculos_timestamp" BEFORE UPDATE ON "public"."vehiculos" FOR EACH ROW EXECUTE FUNCTION "public"."update_vehiculos_modtime"();



ALTER TABLE ONLY "public"."auditoria"
    ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."despachos_pedidos"
    ADD CONSTRAINT "despachos_pedidos_despacho_id_fkey" FOREIGN KEY ("despacho_id") REFERENCES "public"."despachos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."despachos_pedidos"
    ADD CONSTRAINT "despachos_pedidos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos_cabecera"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."despachos"
    ADD CONSTRAINT "despachos_repartidor_id_fkey" FOREIGN KEY ("repartidor_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."despachos"
    ADD CONSTRAINT "despachos_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id");



ALTER TABLE ONLY "public"."pedidos_cabecera"
    ADD CONSTRAINT "pedidos_cabecera_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pedidos_cabecera"
    ADD CONSTRAINT "pedidos_cabecera_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pedidos_detalle"
    ADD CONSTRAINT "pedidos_detalle_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos_cabecera"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedidos_detalle"
    ADD CONSTRAINT "pedidos_detalle_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."vehiculos"
    ADD CONSTRAINT "vehiculos_conductor_id_fkey" FOREIGN KEY ("conductor_id") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;



CREATE POLICY "Lectura de roles para usuarios autenticados" ON "public"."roles" FOR SELECT TO "authenticated" USING (("estado" = true));



CREATE POLICY "Lectura municipios" ON "public"."municipios" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lectura tipos_identificacion" ON "public"."tipos_identificacion" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."auditoria" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_insert_comercial" ON "public"."clientes" FOR INSERT TO "authenticated" WITH CHECK (("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'vendedor'::"text"])));



CREATE POLICY "clientes_select_operativo" ON "public"."clientes" FOR SELECT TO "authenticated" USING (("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'vendedor'::"text", 'despachador'::"text", 'repartidor'::"text"])));



CREATE POLICY "clientes_update_comercial" ON "public"."clientes" FOR UPDATE TO "authenticated" USING (("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'vendedor'::"text"]))) WITH CHECK (("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'vendedor'::"text"])));



ALTER TABLE "public"."despachos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "despachos_insert_logistica" ON "public"."despachos" FOR INSERT TO "authenticated" WITH CHECK (("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'despachador'::"text"])));



ALTER TABLE "public"."despachos_pedidos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "despachos_pedidos_select_operativo" ON "public"."despachos_pedidos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."despachos" "d"
  WHERE (("d"."id" = "despachos_pedidos"."despacho_id") AND (("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'despachador'::"text"])) OR ("d"."repartidor_id" = "auth"."uid"()))))));



CREATE POLICY "despachos_select_operativo" ON "public"."despachos" FOR SELECT TO "authenticated" USING ((("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'despachador'::"text"])) OR ("repartidor_id" = "auth"."uid"())));



CREATE POLICY "despachos_update_logistica" ON "public"."despachos" FOR UPDATE TO "authenticated" USING ((("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'despachador'::"text"])) OR ("repartidor_id" = "auth"."uid"()))) WITH CHECK ((("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'despachador'::"text"])) OR ("repartidor_id" = "auth"."uid"())));



ALTER TABLE "public"."municipios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pedidos_cabecera" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pedidos_cabecera_insert_comercial" ON "public"."pedidos_cabecera" FOR INSERT TO "authenticated" WITH CHECK (("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'vendedor'::"text"])));



CREATE POLICY "pedidos_cabecera_select_operativo" ON "public"."pedidos_cabecera" FOR SELECT TO "authenticated" USING ((("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'vendedor'::"text", 'despachador'::"text"])) OR (EXISTS ( SELECT 1
   FROM ("public"."despachos_pedidos" "dp"
     JOIN "public"."despachos" "d" ON (("d"."id" = "dp"."despacho_id")))
  WHERE (("dp"."pedido_id" = "pedidos_cabecera"."id") AND ("d"."repartidor_id" = "auth"."uid"()))))));



CREATE POLICY "pedidos_cabecera_update_comercial" ON "public"."pedidos_cabecera" FOR UPDATE TO "authenticated" USING ((("public"."obtener_rol_actual"() = ANY (ARRAY['gerencia'::"text", 'soporte'::"text"])) OR (("public"."obtener_rol_actual"() = 'vendedor'::"text") AND (("estado")::"text" = 'pendiente'::"text")))) WITH CHECK ((("public"."obtener_rol_actual"() = ANY (ARRAY['gerencia'::"text", 'soporte'::"text"])) OR (("public"."obtener_rol_actual"() = 'vendedor'::"text") AND (("estado")::"text" = 'pendiente'::"text"))));



ALTER TABLE "public"."pedidos_detalle" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pedidos_detalle_select_operativo" ON "public"."pedidos_detalle" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."pedidos_cabecera" "pc"
  WHERE (("pc"."id" = "pedidos_detalle"."pedido_id") AND (("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'vendedor'::"text", 'despachador'::"text"])) OR (EXISTS ( SELECT 1
           FROM ("public"."despachos_pedidos" "dp"
             JOIN "public"."despachos" "d" ON (("d"."id" = "dp"."despacho_id")))
          WHERE (("dp"."pedido_id" = "pc"."id") AND ("d"."repartidor_id" = "auth"."uid"())))))))));



ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perfiles_insert_admin" ON "public"."perfiles" FOR INSERT TO "authenticated" WITH CHECK (("public"."obtener_rol_actual"() = ANY (ARRAY['gerencia'::"text", 'soporte'::"text"])));



CREATE POLICY "perfiles_select_activos" ON "public"."perfiles" FOR SELECT TO "authenticated" USING ((("estado" = true) AND ("eliminado" IS NULL)));



CREATE POLICY "perfiles_select_admin_todos" ON "public"."perfiles" FOR SELECT TO "authenticated" USING (("public"."obtener_rol_actual"() = ANY (ARRAY['gerencia'::"text", 'soporte'::"text"])));



CREATE POLICY "perfiles_update_admin" ON "public"."perfiles" FOR UPDATE TO "authenticated" USING (("public"."obtener_rol_actual"() = ANY (ARRAY['gerencia'::"text", 'soporte'::"text"]))) WITH CHECK (("public"."obtener_rol_actual"() = ANY (ARRAY['gerencia'::"text", 'soporte'::"text"])));



CREATE POLICY "perfiles_update_propio" ON "public"."perfiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."productos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "productos_select_operativo" ON "public"."productos" FOR SELECT TO "authenticated" USING (("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'vendedor'::"text", 'despachador'::"text", 'repartidor'::"text"])));



CREATE POLICY "productos_write_admin" ON "public"."productos" TO "authenticated" USING (("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text"]))) WITH CHECK (("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text"])));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tipos_identificacion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehiculos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehiculos_select_operativo" ON "public"."vehiculos" FOR SELECT TO "authenticated" USING ((("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'despachador'::"text"])) OR ("conductor_id" = "auth"."uid"())));



CREATE POLICY "vehiculos_write_logistica" ON "public"."vehiculos" TO "authenticated" USING (("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'despachador'::"text"]))) WITH CHECK (("public"."obtener_rol_actual"() = ANY (ARRAY['soporte'::"text", 'gerencia'::"text", 'despachador'::"text"])));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."actualizar_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bloquear_autoescalada_privilegios"() TO "anon";
GRANT ALL ON FUNCTION "public"."bloquear_autoescalada_privilegios"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bloquear_autoescalada_privilegios"() TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_despacho_transaccional"("p_vehiculo_id" "uuid", "p_repartidor_id" "uuid", "p_fecha_despacho" timestamp with time zone, "p_notas" "text", "p_pedidos_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_despacho_transaccional"("p_vehiculo_id" "uuid", "p_repartidor_id" "uuid", "p_fecha_despacho" timestamp with time zone, "p_notas" "text", "p_pedidos_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_pedido_transaccional"("p_cliente_id" "uuid", "p_vendedor_id" "uuid", "p_notas" "text", "p_detalles" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_pedido_transaccional"("p_cliente_id" "uuid", "p_vendedor_id" "uuid", "p_notas" "text", "p_detalles" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."obtener_rol_actual"() TO "anon";
GRANT ALL ON FUNCTION "public"."obtener_rol_actual"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."obtener_rol_actual"() TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_auditoria"() TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_auditoria"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_auditoria"() TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_user_status"("p_user_id" "uuid", "p_new_status" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_user_status"("p_user_id" "uuid", "p_new_status" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_vehiculos_modtime"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_vehiculos_modtime"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_vehiculos_modtime"() TO "service_role";



GRANT ALL ON TABLE "public"."auditoria" TO "authenticated";
GRANT ALL ON TABLE "public"."auditoria" TO "service_role";



GRANT ALL ON SEQUENCE "public"."auditoria_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."auditoria_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."auditoria_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON TABLE "public"."despachos" TO "authenticated";
GRANT ALL ON TABLE "public"."despachos" TO "service_role";



GRANT ALL ON TABLE "public"."despachos_pedidos" TO "authenticated";
GRANT ALL ON TABLE "public"."despachos_pedidos" TO "service_role";



GRANT ALL ON TABLE "public"."municipios" TO "authenticated";
GRANT ALL ON TABLE "public"."municipios" TO "service_role";



GRANT ALL ON SEQUENCE "public"."municipios_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."municipios_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."municipios_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pedidos_cabecera" TO "authenticated";
GRANT ALL ON TABLE "public"."pedidos_cabecera" TO "service_role";



GRANT ALL ON TABLE "public"."pedidos_detalle" TO "authenticated";
GRANT ALL ON TABLE "public"."pedidos_detalle" TO "service_role";



GRANT ALL ON TABLE "public"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles" TO "service_role";



GRANT ALL ON TABLE "public"."productos" TO "authenticated";
GRANT ALL ON TABLE "public"."productos" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_identificacion" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_identificacion" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tipos_identificacion_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tipos_identificacion_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tipos_identificacion_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."vehiculos" TO "authenticated";
GRANT ALL ON TABLE "public"."vehiculos" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







