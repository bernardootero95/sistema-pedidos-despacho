import { supabase } from "../../../config/supabase";

// Clave camelCase de la configuración en la app -> columna en la base.
const COLUMNAS_POR_CAMPO = {
  metodosPagoActivo: "metodos_pago_activo",
  abonosPedidosActivo: "abonos_pedidos_activo",
  abonosComprasActivo: "abonos_compras_activo",
  facturacionAutomaticaActivo: "facturacion_automatica_activo",
  impresionCartaActivo: "impresion_carta_activo",
  imprimirLogoActivo: "imprimir_logo_activo",
};

const COLUMNAS = Object.values(COLUMNAS_POR_CAMPO).join(", ");

/**
 * Configuración funcional de la empresa (interruptores de la pantalla
 * "Opciones"). Vive en la fila única de `configuracion_sistema`: cada empresa
 * tiene su propio proyecto Supabase, así que no hace falta filtrar por tenant.
 */
export const settingsService = {
  async getConfiguracion() {
    const { data, error } = await supabase
      .from("configuracion_sistema")
      .select(COLUMNAS)
      .single();

    if (error)
      throw new Error("Error al cargar la configuración: " + error.message);

    return Object.fromEntries(
      Object.entries(COLUMNAS_POR_CAMPO).map(([campo, columna]) => [
        campo,
        data[columna],
      ]),
    );
  },

  /**
   * Actualiza un interruptor. `campo` es la clave camelCase de la
   * configuración (ver getConfiguracion).
   */
  async actualizarInterruptor(campo, valor) {
    const columna = COLUMNAS_POR_CAMPO[campo];
    if (!columna) throw new Error(`Opción desconocida: ${campo}`);

    // La tabla tiene una única fila (id = true), por eso el filtro fijo: sin
    // él PostgREST rechaza un UPDATE sin WHERE.
    const { error } = await supabase
      .from("configuracion_sistema")
      .update({ [columna]: valor })
      .eq("id", true);

    if (error)
      throw new Error("Error al guardar la opción: " + error.message);
  },
};
