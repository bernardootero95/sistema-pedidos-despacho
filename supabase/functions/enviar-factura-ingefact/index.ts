import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Secrets propios de esta función (`supabase secrets set INGEFACT_API_URL=...
// INGEFACT_API_KEY=...`), nunca expuestos al frontend. INGEFACT_API_URL es
// la raíz del servidor (ej. http://localhost:8000 en local, la URL real en
// producción/demo) -- el prefijo /api/v1/external/v1 se arma acá.
const INGEFACT_API_URL = Deno.env.get('INGEFACT_API_URL') ?? ''
const INGEFACT_API_KEY = Deno.env.get('INGEFACT_API_KEY') ?? ''
// Correo de respaldo para clientes sin correo propio (ej. "consumidor
// final" de venta de mostrador) -- IngeFact exige uno para crear el
// cliente, pero no tiene que ser un correo que el cliente real reciba.
// Un secret por proyecto en vez de un dominio fijo en el código porque el
// mismo código de Edge Function corre en varios tenants white-label.
const INGEFACT_CORREO_GENERICO = Deno.env.get('INGEFACT_CORREO_GENERICO') ?? ''

class IngefactError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Los errores de FastAPI llegan como {"detail": "mensaje"} (HTTPException) o
// {"detail": [{"msg": "...", ...}, ...]} (error de validación de Pydantic).
function extraerMensajeError(body: any): string {
  const detail = body?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d) => d?.msg || JSON.stringify(d)).join(' ')
  }
  return 'Error al comunicarse con IngeFact.'
}

async function ingefact(path: string, options: RequestInit = {}) {
  const res = await fetch(`${INGEFACT_API_URL}/api/v1/external/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': INGEFACT_API_KEY,
      ...(options.headers || {}),
    },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new IngefactError(res.status, extraerMensajeError(body))
  }
  return body
}

// Nombre a mostrar: razón social si es persona jurídica, o nombre completo
// si es persona natural -- misma regla que getNombreCliente en el frontend
// (src/modules/clients/utils/clienteDisplay.js), duplicada acá porque las
// Edge Functions no comparten bundle con el frontend.
function nombreCliente(cliente: any): string {
  const nombreCompleto = `${cliente.primer_nombre || ''} ${cliente.primer_apellido || ''}`.trim()
  return cliente.razon_social || nombreCompleto
}

// Traduce una línea de pedidos_detalle al ítem embebido que espera IngeFact.
// El sistema no registra unidad de medida por producto: se usa "94" (DIAN:
// unidad) como default fijo, válido para el catálogo actual (bienes físicos
// vendidos por unidad). El ítem embebido de IngeFact solo admite UN tributo
// por línea; si un producto tuviera IVA e INC a la vez (el esquema lo
// permite aunque DIAN no suele gravar ambos sobre el mismo bien) se
// prioriza IVA por ser el caso normal del catálogo.
function lineaFactura(detalle: any) {
  const iva = Number(detalle.iva_porcentaje) || 0
  const inc = Number(detalle.inc_porcentaje) || 0
  const [tributo, tarifa_impuesto] = iva > 0 ? ['01', iva] : inc > 0 ? ['02', inc] : [null, 0]

  return {
    codigo: detalle.producto?.codigo || detalle.producto_id,
    nombre: detalle.producto?.nombre || 'Producto',
    tipo: 'bien',
    unidad_medida: '94',
    tributo,
    tarifa_impuesto,
    cantidad: Number(detalle.cantidad),
    precio_unitario: Number(detalle.precio_unitario),
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const responder = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    })

  try {
    if (!INGEFACT_API_URL || !INGEFACT_API_KEY) {
      throw new IngefactError(500, 'La integración con IngeFact no está configurada (faltan INGEFACT_API_URL/INGEFACT_API_KEY).')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Enviar una factura a la DIAN es una acción sensible e irreversible:
    // se restringe explícitamente a soporte (no gerencia/despachador/etc.),
    // igual patrón de verificación de rol que create-user/reset-user-password.
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')

    const { data: { user: caller }, error: callerError } =
      await supabaseAdmin.auth.getUser(jwt)

    if (callerError || !caller) {
      return responder({ error: 'No autenticado.' }, 401)
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('perfiles')
      .select('estado, roles ( nombre )')
      .eq('id', caller.id)
      .single()

    const autorizado =
      !profileError && callerProfile?.estado === true && callerProfile?.roles?.nombre === 'soporte'

    if (!autorizado) {
      return responder({ error: 'No tienes permiso para facturar pedidos.' }, 403)
    }

    const { pedido_id } = await req.json()
    if (!pedido_id) {
      return responder({ error: 'Falta el pedido a facturar.' }, 400)
    }

    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos_cabecera')
      .select(`
        id, estado, fecha_pedido, ingefact_factura_id,
        clientes ( id, tipo_identificacion, numero_identificacion, digito_verificacion, primer_nombre, primer_apellido, razon_social, correo, telefono, ingefact_cliente_id ),
        detalles:pedidos_detalle ( cantidad, precio_unitario, iva_porcentaje, inc_porcentaje, producto_id, producto:productos ( codigo, nombre ) )
      `)
      .eq('id', pedido_id)
      .is('eliminado', null)
      .single()

    if (pedidoError || !pedido) {
      return responder({ error: 'Pedido no encontrado.' }, 404)
    }
    if (pedido.ingefact_factura_id) {
      return responder({ error: 'Este pedido ya fue facturado en IngeFact.' }, 409)
    }
    if (pedido.estado !== 'entregado') {
      return responder({ error: 'Solo se pueden facturar pedidos ya entregados.' }, 409)
    }

    const cliente = pedido.clientes as any
    const correoFacturacion = cliente?.correo || INGEFACT_CORREO_GENERICO
    if (!correoFacturacion) {
      return responder(
        {
          error:
            'El cliente no tiene correo registrado y no hay un correo genérico configurado. Completa el correo del cliente o configura el secret INGEFACT_CORREO_GENERICO.',
        },
        422,
      )
    }

    let ingefactClienteId = cliente.ingefact_cliente_id as string | null

    if (!ingefactClienteId) {
      // El cliente puede ya existir en IngeFact (creado por otra vía, ej. el
      // admin de IngeFact) sin que este sistema lo sepa todavía -- IngeFact
      // rechaza con 409 un número de identificación duplicado por empresa,
      // así que se busca primero por NIT exacto antes de intentar crear.
      const encontrados = await ingefact(`/clientes?search=${encodeURIComponent(cliente.numero_identificacion)}`)
      const existente = (encontrados || []).find(
        (c: any) => c.numero_identificacion === cliente.numero_identificacion,
      )

      ingefactClienteId = existente
        ? existente.id
        : (
            await ingefact('/clientes', {
              method: 'POST',
              body: JSON.stringify({
                tipo_identificacion: cliente.tipo_identificacion,
                numero_identificacion: cliente.numero_identificacion,
                digito_verificacion: cliente.digito_verificacion || null,
                nombre: nombreCliente(cliente),
                correo_electronico: correoFacturacion,
                telefono: cliente.telefono || null,
              }),
            })
          ).id

      await supabaseAdmin
        .from('clientes')
        .update({ ingefact_cliente_id: ingefactClienteId })
        .eq('id', cliente.id)
    }

    const borrador = await ingefact('/facturas', {
      method: 'POST',
      body: JSON.stringify({
        cliente_id: ingefactClienteId,
        fecha: String(pedido.fecha_pedido).slice(0, 10),
        lineas: (pedido.detalles || []).map(lineaFactura),
      }),
    })

    const enviada = await ingefact(`/facturas/${borrador.id}/enviar`, {
      method: 'POST',
      body: JSON.stringify({ forma_pago: '1', metodo_pago: '10' }),
    })

    await supabaseAdmin
      .from('pedidos_cabecera')
      .update({
        ingefact_factura_id: enviada.id,
        ingefact_numero_factura: enviada.numero_completo,
        ingefact_enviado_en: new Date().toISOString(),
      })
      .eq('id', pedido_id)

    return responder(
      {
        message: 'Factura enviada a IngeFact.',
        factura: {
          numero_completo: enviada.numero_completo,
          estado: enviada.estado,
          cufe: enviada.cufe,
          total: enviada.total,
        },
      },
      200,
    )
  } catch (error: any) {
    const status = error instanceof IngefactError ? error.status : 400
    return responder({ error: error.message || 'Error al facturar el pedido.' }, status >= 500 ? 502 : status)
  }
})
