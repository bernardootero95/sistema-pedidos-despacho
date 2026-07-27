-- 1. FUNCIÓN GENÉRICA PARA ACTUALIZAR EL CAMPO 'actualizado' AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. TABLA DE ROLES Y PERMISOS
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    permisos JSONB DEFAULT '[]'::jsonb, -- Se irá poblando progresivamente en cada módulo desarrollado
    estado BOOLEAN DEFAULT true NOT NULL,
    creado TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    actualizado TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    eliminado TIMESTAMPTZ DEFAULT NULL
);

-- Trigger para roles
CREATE TRIGGER set_timestamp_roles
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- Insertar los 5 roles base (Permisos en blanco para definirse por módulo, excepto acceso total)
INSERT INTO roles (nombre, permisos) VALUES
('soporte', '["all"]'::jsonb),
('gerencia', '["all"]'::jsonb),
('vendedor', '[]'::jsonb),
('despachador', '[]'::jsonb),
('repartidor', '[]'::jsonb)
ON CONFLICT (nombre) DO NOTHING;

-- 3. TABLA DE PERFILES DE USUARIO (Vinculada a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_usuario VARCHAR(50) UNIQUE NOT NULL, -- Nombre corto para login sin @empresa.com
    nombre_completo VARCHAR(100) NOT NULL,
    rol_id INTEGER REFERENCES roles(id) ON DELETE RESTRICT,
    estado BOOLEAN DEFAULT true NOT NULL,
    creado TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    actualizado TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    eliminado TIMESTAMPTZ DEFAULT NULL
);

-- Trigger para perfiles
CREATE TRIGGER set_timestamp_perfiles
BEFORE UPDATE ON perfiles
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- 4. TABLA DE AUDITORÍA GENERAL
CREATE TABLE IF NOT EXISTS auditoria (
    id BIGSERIAL PRIMARY KEY,
    tabla VARCHAR(50) NOT NULL,
    operacion VARCHAR(10) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    registro_id VARCHAR(50) NOT NULL,
    datos_anteriores JSONB DEFAULT NULL,
    datos_nuevos JSONB DEFAULT NULL,
    usuario_id UUID REFERENCES auth.users(id) DEFAULT NULL,
    creado TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. FUNCIÓN Y TRIGGER MAESTRO DE AUDITORÍA PARA REUTILIZAR EN CUALQUIER TABLA
CREATE OR REPLACE FUNCTION registrar_auditoria()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar auditoría automática a las tablas iniciales
CREATE TRIGGER audit_roles AFTER INSERT OR UPDATE OR DELETE ON roles FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER audit_perfiles AFTER INSERT OR UPDATE OR DELETE ON perfiles FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- 6. HABILITAR SEGURIDAD POR FILAS (RLS)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura base: Los usuarios autenticados pueden leer sus perfiles y los roles
CREATE POLICY "Lectura de roles para usuarios autenticados" ON roles FOR SELECT TO authenticated USING (estado = true);
CREATE POLICY "Lectura de perfiles activos" ON perfiles FOR SELECT TO authenticated USING (estado = true AND eliminado IS NULL);
CREATE POLICY "Los usuarios pueden ver su propio perfil" ON perfiles FOR ALL TO authenticated USING (auth.uid() = id);