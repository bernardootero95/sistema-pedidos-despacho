-- ============================================================================
-- Correo de recuperación opcional para perfiles
-- ============================================================================
-- El login sigue siendo por nombre_usuario -> email sintético
-- (nombre_usuario@DOMAIN, ver authService.login). Este `correo` es un dato
-- de contacto real e independiente, NO se usa para autenticar ni se
-- sincroniza contra auth.users.email — cambiarlo rompería el login actual.
--
-- Cuando `correo` existe, habilita en el login el flujo self-service de
-- "olvidé mi contraseña" (ver authService.solicitarRecuperacionPassword).
--
-- IMPORTANTE: supabase.auth.resetPasswordForEmail() solo envía el correo si
-- el destinatario coincide EXACTAMENTE con el email registrado en
-- auth.users para esa cuenta (el sintético, no este `correo`). Por eso el
-- flujo de recuperación llama a resetPasswordForEmail con el email
-- sintético — `correo` funciona como gate ("¿esta cuenta tiene una bandeja
-- real detrás de su alias de login?"), no como destinatario literal.
-- ============================================================================

ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS correo VARCHAR(255);

-- ----------------------------------------------------------------------------
-- RPC pública (anon): permite que el login pregunte "¿este usuario tiene
-- recuperación por correo habilitada?" sin autenticarse todavía. Devuelve
-- el mismo `false` tanto si el usuario no existe como si existe sin correo,
-- para no confirmar/descartar la existencia de una cuenta desde el login.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tiene_correo_recuperacion(p_nombre_usuario TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles
    WHERE nombre_usuario = lower(trim(p_nombre_usuario))
      AND correo IS NOT NULL
      AND estado = true
      AND eliminado IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION tiene_correo_recuperacion(TEXT) TO anon, authenticated;
