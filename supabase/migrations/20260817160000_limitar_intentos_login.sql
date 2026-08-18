-- Auditoría #11: limitar intentos de login.
-- Usa el Password Verification Hook de Supabase Auth: GoTrue invoca esta
-- función en cada intento de password (válido o no) ANTES de decidir si
-- autentica. No reemplaza la validación de Supabase, la complementa: puede
-- rechazar (`reject`) un intento aunque la contraseña sea correcta si la
-- cuenta está bloqueada por intentos previos.
--
-- Bloqueo: 5 intentos fallidos en una ventana de 15 minutos → bloqueo de
-- 15 minutos. El contador se reinicia en el primer login exitoso.
--
-- Requiere un paso manual fuera de esta migración: habilitar el hook en
-- Supabase Dashboard → Authentication → Hooks → "Password Verification
-- Attempt", apuntando a esta función. No es configurable por SQL/migración.

create table public.auth_intentos_fallidos (
  user_id uuid primary key,
  intentos integer not null default 0,
  primer_intento_en timestamptz not null default now(),
  bloqueado_hasta timestamptz
);

comment on table public.auth_intentos_fallidos is
  'Estado efímero de intentos fallidos de login por usuario, leído y escrito por el Password Verification Hook. No es una tabla de dominio: no sigue el patrón estado/creado/actualizado/eliminado.';

create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_user_id uuid := (event->>'user_id')::uuid;
  v_valid boolean := (event->>'valid')::boolean;
  v_intentos integer;
  v_primer_intento timestamptz;
  v_bloqueado_hasta timestamptz;
  v_existe boolean;
  v_max_intentos constant integer := 5;
  v_ventana constant interval := interval '15 minutes';
  v_bloqueo constant interval := interval '15 minutes';
begin
  select intentos, primer_intento_en, bloqueado_hasta
    into v_intentos, v_primer_intento, v_bloqueado_hasta
    from public.auth_intentos_fallidos
    where user_id = v_user_id
    for update;

  v_existe := found;

  -- Cuenta bloqueada vigente: rechaza incluso si la contraseña es correcta,
  -- para que no sirva de nada probar credenciales durante el bloqueo.
  if v_bloqueado_hasta is not null and v_bloqueado_hasta > now() then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta de nuevo en unos minutos.'
    );
  end if;

  if v_valid then
    delete from public.auth_intentos_fallidos where user_id = v_user_id;
    return jsonb_build_object('decision', 'continue');
  end if;

  if not v_existe or now() - v_primer_intento > v_ventana then
    insert into public.auth_intentos_fallidos (user_id, intentos, primer_intento_en, bloqueado_hasta)
      values (v_user_id, 1, now(), null)
      on conflict (user_id) do update
        set intentos = 1, primer_intento_en = now(), bloqueado_hasta = null;
  else
    update public.auth_intentos_fallidos
      set intentos = intentos + 1,
          bloqueado_hasta = case
            when intentos + 1 >= v_max_intentos then now() + v_bloqueo
            else null
          end
      where user_id = v_user_id;
  end if;

  -- Deja que Supabase Auth aplique su comportamiento normal para el intento
  -- fallido (mensaje genérico de "Invalid login credentials").
  return jsonb_build_object('decision', 'continue');
end;
$$;

comment on function public.hook_password_verification_attempt is
  'Password Verification Hook (auditoría #11). Se activa manualmente en Authentication > Hooks del dashboard de Supabase; no queda activo solo con esta migración.';

grant all on table public.auth_intentos_fallidos to supabase_auth_admin;
revoke all on table public.auth_intentos_fallidos from authenticated, anon, public;

grant execute on function public.hook_password_verification_attempt to supabase_auth_admin;
revoke execute on function public.hook_password_verification_attempt from authenticated, anon, public;
