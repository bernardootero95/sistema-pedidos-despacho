-- ============================================================================
-- Permite a gerencia/soporte cambiar el rol de un usuario ya existente
-- ============================================================================
-- Hasta ahora el rol solo se definía al crear el usuario (Edge Function
-- create-user); UserForm.jsx no ofrecía edición de rol. El trigger
-- trg_bloquear_autoescalada ya permitía a gerencia/soporte modificar
-- rol_id directamente vía UPDATE, pero se centraliza en una función RPC
-- transaccional (mismo patrón que toggle_user_status) para: validar el
-- rol de forma explícita, bloquear la auto-modificación (evitar que un
-- admin se quite privilegios a sí mismo por error) y devolver el perfil
-- actualizado en una sola llamada.
-- ============================================================================
CREATE OR REPLACE FUNCTION actualizar_rol_usuario(p_user_id UUID, p_rol_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF obtener_rol_actual() NOT IN ('gerencia', 'soporte') THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar el rol de un usuario.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM roles
    WHERE id = p_rol_id AND estado = true AND eliminado IS NULL
  ) THEN
    RAISE EXCEPTION 'El rol seleccionado no es válido.';
  END IF;

  UPDATE perfiles
  SET rol_id = p_rol_id
  WHERE id = p_user_id
  RETURNING row_to_json(perfiles.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado.';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION actualizar_rol_usuario(UUID, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION actualizar_rol_usuario(UUID, INTEGER) FROM anon;
