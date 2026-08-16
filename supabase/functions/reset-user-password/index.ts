import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de preflight de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Cliente con privilegios de admin (SERVICE_ROLE): necesario para
    // updateUserById, que no está expuesto por las políticas RLS.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // verify_jwt=true (config.toml) ya rechaza requests sin un JWT válido
    // antes de llegar aquí, pero eso solo confirma "hay una sesión válida",
    // no "esta sesión es de gerencia/soporte". A diferencia de create-user,
    // esta función SÍ resuelve el rol del llamante y lo exige, porque
    // restablecer la contraseña de OTRO usuario es una acción más sensible
    // que cualquier operación cubierta hoy por una política RLS.
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')

    const { data: { user: caller }, error: callerError } =
      await supabaseAdmin.auth.getUser(jwt)

    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: 'No autenticado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('perfiles')
      .select('estado, roles ( nombre )')
      .eq('id', caller.id)
      .single()

    const callerRole = callerProfile?.roles?.nombre
    const autorizado =
      !profileError &&
      callerProfile?.estado === true &&
      (callerRole === 'gerencia' || callerRole === 'soporte')

    if (!autorizado) {
      return new Response(
        JSON.stringify({ error: 'No tienes permiso para restablecer contraseñas.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const { user_id, new_password } = await req.json()

    if (!user_id || !new_password || String(new_password).length < 6) {
      return new Response(
        JSON.stringify({ error: 'Datos inválidos: se requiere user_id y una contraseña de al menos 6 caracteres.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    )

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ message: 'Contraseña restablecida exitosamente.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
