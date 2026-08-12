-- ============================================================================
-- Endurecimiento final: privilegios por defecto y grants residuales de anon
-- ============================================================================
-- La migración 20260811221215_rls_permisos_por_rol.sql revocó el acceso de
-- 'anon' sobre las tablas EXISTENTES en ese momento (REVOKE ALL ON ALL TABLES
-- IN SCHEMA public FROM anon) y sobre 3 funciones puntuales. Pero no tocó
-- ALTER DEFAULT PRIVILEGES, que es una regla independiente: define qué
-- privilegios se otorgan automáticamente a objetos NUEVOS que cree el rol
-- 'postgres' en el futuro. Verificado contra schema_dump.sql real: esa regla
-- seguía viva para TABLES, SEQUENCES y FUNCTIONS, es decir, cualquier tabla o
-- función nueva heredaría acceso total para 'anon' desde el día uno, sin que
-- nadie lo pidiera explícitamente.
--
-- Esta app no tiene flujo anónimo (todo pasa por login), así que 'anon' no
-- debería tener privilegios por defecto sobre nada nuevo que se cree.
--
-- De paso, cierro los 5 grants puntuales a 'anon' que quedaron sobre
-- funciones ya existentes (creadas antes de este endurecimiento, heredaron
-- el default privilege vigente en su momento). Ninguna es explotable hoy:
-- 4 de ellas devuelven "trigger" y Postgres no permite invocarlas fuera de
-- un trigger; obtener_rol_actual() con un caller sin sesión simplemente
-- devuelve NULL. Aun así, se cierran por consistencia con el principio de
-- mínimo privilegio ya aplicado al resto del esquema.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Privilegios por defecto para objetos futuros
-- ----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- ----------------------------------------------------------------------------
-- 2. Grants residuales sobre funciones ya existentes
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION actualizar_timestamp() FROM anon;
REVOKE EXECUTE ON FUNCTION registrar_auditoria() FROM anon;
REVOKE EXECUTE ON FUNCTION update_vehiculos_modtime() FROM anon;
REVOKE EXECUTE ON FUNCTION obtener_rol_actual() FROM anon;
REVOKE EXECUTE ON FUNCTION bloquear_autoescalada_privilegios() FROM anon;

-- Nota: no se toca 'authenticated' ni 'service_role' en ningún punto de esta
-- migración. authenticated sigue con acceso vía las políticas RLS por rol
-- definidas en 20260811221215_rls_permisos_por_rol.sql; service_role (usado
-- por el backend/servidor, si aplica) nunca pasa por RLS ni por estos GRANTs.