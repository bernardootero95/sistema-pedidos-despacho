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
    // Inicializar cliente de Supabase con Service Role (Privilegios de Admin)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, password, nombre_usuario, nombre_completo, rol_id, correo } = await req.json()

    // 1. Crear usuario en el motor de Auth nativo
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Lo auto-confirmamos para que no requiera validación por correo
    })

    if (authError) throw authError

    // 2. Vincular el perfil en nuestra tabla pública (Lógica de negocio)
    const { error: profileError } = await supabaseAdmin
      .from('perfiles')
      .insert({
        id: authData.user.id,
        nombre_usuario,
        nombre_completo,
        rol_id,
        correo: correo || null,
        estado: true
      })

    // Rollback manual si falla la creación del perfil
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }

    return new Response(
      JSON.stringify({ message: 'Usuario creado exitosamente', user: authData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})