import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

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

type Accion = 'facturar' | 'anular'

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

// Fecha de hoy en zona horaria de Colombia (YYYY-MM-DD) -- toISOString()
// da la fecha en UTC, que de noche ya cae al día siguiente ahí.
function fechaHoyBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

// Medio de pago DIAN de la factura a partir de los pagos del pedido (neto por
// código: pagos - devoluciones). IngeFact solo acepta UN metodo_pago por
// factura: con un único código se envía ese; si el pedido se pagó con
// medios distintos se envía 'ZZZ' (acuerdo mutuo); sin pagos registrados
// (o con la opción de métodos de pago apagada, que solo genera Efectivo)
// queda '10' (efectivo), como antes de existir los métodos de pago.
const MEDIO_PAGO_EFECTIVO = '10'
const MEDIO_PAGO_MIXTO = 'ZZZ'

function medioPagoDian(pagos: any[]): string {
  const netoPorCodigo = new Map<string, number>()
  for (const pago of pagos || []) {
    const codigo = pago?.metodo?.codigo_dian || MEDIO_PAGO_EFECTIVO
    const monto = Number(pago?.monto) || 0
    const delta = pago?.tipo === 'devolucion' ? -monto : monto
    netoPorCodigo.set(codigo, (netoPorCodigo.get(codigo) || 0) + delta)
  }

  const codigos = [...netoPorCodigo.entries()]
    .filter(([, neto]) => neto > 0)
    .map(([codigo]) => codigo)

  if (codigos.length === 0) return MEDIO_PAGO_EFECTIVO
  if (codigos.length === 1) return codigos[0]
  return MEDIO_PAGO_MIXTO
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

  // pedidos_detalle.precio_unitario es el precio de venta CON impuesto
  // incluido (así lo arma crear_pedido_transaccional desde
  // productos.precio_venta) -- IngeFact espera el precio SIN impuesto y le
  // suma tarifa_impuesto encima, así que hay que descontarlo acá primero.
  // Misma cuenta que ya hace OrderDetailsPage para mostrar la "base
  // gravable" (baseLinea = subtotalLinea / factor).
  const factor = 1 + (iva + inc) / 100
  const precioBase = Number(detalle.precio_unitario) / factor

  return {
    codigo: detalle.producto?.codigo || detalle.producto_id,
    nombre: detalle.producto?.nombre || 'Producto',
    tipo: 'bien',
    unidad_medida: '94',
    tributo,
    tarifa_impuesto,
    cantidad: Number(detalle.cantidad),
    precio_unitario: precioBase,
  }
}

// Busca o crea el cliente del pedido en IngeFact y lo deja enlazado.
async function resolverClienteIngefact(supabaseAdmin: SupabaseClient, cliente: any): Promise<string> {
  if (cliente.ingefact_cliente_id) return cliente.ingefact_cliente_id

  const correoFacturacion = cliente?.correo || INGEFACT_CORREO_GENERICO
  if (!correoFacturacion) {
    throw new IngefactError(
      422,
      'El cliente no tiene correo registrado y no hay un correo genérico configurado. Completa el correo del cliente o configura el secret INGEFACT_CORREO_GENERICO.',
    )
  }

  // El cliente puede ya existir en IngeFact (creado por otra vía, ej. el
  // admin de IngeFact) sin que este sistema lo sepa todavía -- IngeFact
  // rechaza con 409 un número de identificación duplicado por empresa,
  // así que se busca primero por NIT exacto antes de intentar crear.
  const encontrados = await ingefact(`/clientes?search=${encodeURIComponent(cliente.numero_identificacion)}`)
  const existente = (encontrados || []).find(
    (c: any) => c.numero_identificacion === cliente.numero_identificacion,
  )

  const ingefactClienteId = existente
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

  return ingefactClienteId
}

async function facturar(supabaseAdmin: SupabaseClient, pedidoId: string) {
  const { data: pedido, error: pedidoError } = await supabaseAdmin
    .from('pedidos_cabecera')
    .select(`
      id,
      clientes ( id, tipo_identificacion, numero_identificacion, digito_verificacion, primer_nombre, primer_apellido, razon_social, correo, telefono, ingefact_cliente_id ),
      detalles:pedidos_detalle ( cantidad, precio_unitario, iva_porcentaje, inc_porcentaje, producto_id, producto:productos ( codigo, nombre ) )
    `)
    .eq('id', pedidoId)
    .single()

  if (pedidoError || !pedido) throw new IngefactError(404, 'Pedido no encontrado.')

  const { data: pagos, error: pagosError } = await supabaseAdmin
    .from('pagos')
    .select('tipo, monto, metodo:metodos_pago ( codigo_dian )')
    .eq('pedido_id', pedidoId)

  if (pagosError) throw new IngefactError(500, 'No se pudieron consultar los pagos del pedido.')

  const ingefactClienteId = await resolverClienteIngefact(supabaseAdmin, pedido.clientes)

  const borrador = await ingefact('/facturas', {
    method: 'POST',
    body: JSON.stringify({
      cliente_id: ingefactClienteId,
      // Fecha de EMISIÓN de la factura (hoy), no la del pedido: un pedido
      // puede tomarse, entregarse y facturarse en tres días distintos --
      // fecha_pedido/fecha_entrega quedan en pedidos_cabecera, la fecha de
      // factura la marca ingefact_enviado_en (guardado más abajo).
      fecha: fechaHoyBogota(),
      lineas: (pedido.detalles || []).map(lineaFactura),
    }),
  })

  const enviada = await ingefact(`/facturas/${borrador.id}/enviar`, {
    method: 'POST',
    body: JSON.stringify({ forma_pago: '1', metodo_pago: medioPagoDian(pagos || []) }),
  })

  // Si el pedido ya tuvo una factura anulada, la nueva la reemplaza: el
  // antes/después queda en `auditoria` por el trigger de pedidos_cabecera.
  await supabaseAdmin
    .from('pedidos_cabecera')
    .update({
      ingefact_factura_id: enviada.id,
      ingefact_numero_factura: enviada.numero_completo,
      ingefact_enviado_en: new Date().toISOString(),
      ingefact_nota_credito_id: null,
      ingefact_numero_nota_credito: null,
      ingefact_anulado_en: null,
      ingefact_estado: 'facturada',
      ingefact_error: null,
      ingefact_en_curso_desde: null,
    })
    .eq('id', pedidoId)

  return {
    message: 'Factura enviada a IngeFact.',
    factura: {
      numero_completo: enviada.numero_completo,
      estado: enviada.estado,
      cufe: enviada.cufe,
      total: enviada.total,
    },
  }
}

async function anular(supabaseAdmin: SupabaseClient, pedidoId: string) {
  const { data: pedido, error: pedidoError } = await supabaseAdmin
    .from('pedidos_cabecera')
    .select('ingefact_factura_id')
    .eq('id', pedidoId)
    .single()

  if (pedidoError || !pedido) throw new IngefactError(404, 'Pedido no encontrado.')

  let nota: any = null
  try {
    nota = await ingefact(`/facturas/${pedido.ingefact_factura_id}/anular`, { method: 'POST' })
  } catch (error) {
    // 409 "completamente acreditada": la nota crédito ya existe en IngeFact
    // (ej. un intento anterior se emitió pero no alcanzó a guardarse acá, o
    // se anuló a mano desde IngeFact). La factura ya no está vigente.
    const yaAnulada = error instanceof IngefactError && error.status === 409 && /acreditada/i.test(error.message)
    if (!yaAnulada) throw error
  }

  // La DIAN puede rechazar la nota sin que IngeFact responda con error HTTP.
  if (nota && nota.estado !== 'aceptada') {
    throw new IngefactError(
      422,
      `La nota crédito quedó en estado "${nota.estado}"${nota.razon_rechazo ? `: ${nota.razon_rechazo}` : ''}.`,
    )
  }

  await supabaseAdmin
    .from('pedidos_cabecera')
    .update({
      ingefact_nota_credito_id: nota?.id ?? null,
      ingefact_numero_nota_credito: nota?.numero_completo ?? null,
      ingefact_anulado_en: new Date().toISOString(),
      ingefact_estado: 'anulada',
      ingefact_error: null,
      ingefact_en_curso_desde: null,
    })
    .eq('id', pedidoId)

  return {
    message: 'Factura anulada en IngeFact.',
    nota_credito: { numero_completo: nota?.numero_completo ?? null },
  }
}

// Ejecuta la acción con el candado del pedido tomado y deja el error en el
// pedido si falla, para que soporte lo vea y pueda reintentar.
async function ejecutar(supabaseAdmin: SupabaseClient, pedidoId: string, accion: Accion, forzar: boolean) {
  const { data: motivo, error: candadoError } = await supabaseAdmin.rpc('iniciar_operacion_ingefact', {
    p_pedido_id: pedidoId,
    p_accion: accion,
    p_forzar: forzar,
  })
  if (candadoError) throw new IngefactError(500, candadoError.message)
  if (motivo) throw new IngefactError(409, motivo)

  try {
    return accion === 'facturar'
      ? await facturar(supabaseAdmin, pedidoId)
      : await anular(supabaseAdmin, pedidoId)
  } catch (error: any) {
    await supabaseAdmin
      .from('pedidos_cabecera')
      .update({
        ingefact_estado: accion === 'facturar' ? 'error_facturacion' : 'error_anulacion',
        ingefact_error: error.message || 'Error desconocido.',
        ingefact_en_curso_desde: null,
      })
      .eq('id', pedidoId)
    throw error
  }
}

// Si el estado del pedido cambió mientras la operación estaba en curso (ej.
// se anuló el pedido mientras se emitía su factura), el trigger no pudo
// encolar la acción contraria porque todavía no había factura vigente, o
// porque había una por anular. Se resuelve acá, al soltar el candado.
async function reconciliar(supabaseAdmin: SupabaseClient, pedidoId: string, ultimaAccion: Accion) {
  const { data: pedido } = await supabaseAdmin
    .from('pedidos_cabecera')
    .select('estado')
    .eq('id', pedidoId)
    .single()
  if (!pedido) return

  if (ultimaAccion === 'facturar' && pedido.estado !== 'entregado') {
    await ejecutar(supabaseAdmin, pedidoId, 'anular', false)
    return
  }

  if (ultimaAccion === 'anular' && pedido.estado === 'entregado') {
    const { data: config } = await supabaseAdmin
      .from('configuracion_sistema')
      .select('facturacion_automatica_activo')
      .single()
    if (config?.facturacion_automatica_activo) {
      await ejecutar(supabaseAdmin, pedidoId, 'facturar', false)
    }
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

    // Dos orígenes posibles (por eso verify_jwt = false en config.toml):
    //   - Automático: trg_encolar_operacion_ingefact vía pg_net, con el
    //     secreto de Vault en x-facturacion-secreto.
    //   - Manual: botón de soporte, con el JWT del usuario. Emitir/anular un
    //     documento ante la DIAN es sensible e irreversible: se restringe a
    //     soporte, igual patrón que create-user/reset-user-password.
    const secreto = req.headers.get('x-facturacion-secreto')
    let esAutomatico = false

    if (secreto) {
      const { data: valido } = await supabaseAdmin.rpc('validar_secreto_facturacion_ingefact', {
        p_secreto: secreto,
      })
      if (!valido) return responder({ error: 'No autenticado.' }, 401)
      esAutomatico = true
    } else {
      const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
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
    }

    const { pedido_id, accion = 'facturar' } = await req.json()
    if (!pedido_id) {
      return responder({ error: 'Falta el pedido a facturar.' }, 400)
    }
    if (accion !== 'facturar' && accion !== 'anular') {
      return responder({ error: 'Acción inválida.' }, 400)
    }

    // Solo una persona puede forzar un candado abandonado (ver
    // iniciar_operacion_ingefact).
    const resultado = await ejecutar(supabaseAdmin, pedido_id, accion, !esAutomatico)
    await reconciliar(supabaseAdmin, pedido_id, accion).catch((error) => {
      console.error('No se pudo reconciliar la facturación del pedido', pedido_id, error)
    })

    return responder(resultado, 200)
  } catch (error: any) {
    const status = error instanceof IngefactError ? error.status : 400
    return responder({ error: error.message || 'Error al facturar el pedido.' }, status >= 500 ? 502 : status)
  }
})
