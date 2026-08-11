-- ============================================================================
-- Corrección: toggle_user_status no validaba el rol de quien la ejecuta
-- ============================================================================
-- Es SECURITY DEFINER, así que las políticas RLS de perfiles no la protegen:
-- corre con los privilegios del dueño de la función (postgres), no con los
-- del usuario autenticado. Cualquier autenticado podía suspender/reactivar
-- a cualquier otro usuario, incluida gerencia. La validación de rol debe
-- vivir dentro de la función.
--
-- Nota: el UPDATE que hace esta función sigue disparando el trigger
-- trg_bloquear_autoescalada (migración anterior) porque los triggers no se
-- saltan por SECURITY DEFINER. No hay conflicto: ambos chequeos usan
-- obtener_rol_actual(), que lee el JWT real del llamador (auth.uid()), no
-- el dueño de la función.
-- ============================================================================

CREATE OR REPLACE FUNCTION toggle_user_status(p_user_id UUID, p_new_status BOOLEAN)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION toggle_user_status(UUID, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION toggle_user_status(UUID, BOOLEAN) FROM anon;