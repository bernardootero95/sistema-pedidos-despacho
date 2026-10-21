import { supabase } from "../../../config/supabase";

const COLUMNAS = "id, mensaje, estado";

/**
 * Pies de factura: mensajes que se imprimen al final de los comprobantes
 * (promociones, avisos). Los leen todos los roles al imprimir; solo
 * soporte/gerencia los administran (RLS).
 */
export const invoiceFooterService = {
  /**
   * Mensajes vigentes (sin borrados lógicos), en el orden en que se crearon.
   * Catálogo pequeño, no se pagina. `soloActivos` lo usa la impresión.
   */
  async getPies({ soloActivos = false } = {}) {
    let query = supabase
      .from("pies_factura")
      .select(COLUMNAS)
      .is("eliminado", null)
      .order("creado", { ascending: true });

    if (soloActivos) query = query.eq("estado", true);

    const { data, error } = await query;

    if (error)
      throw new Error("Error al cargar los pies de factura: " + error.message);
    return data || [];
  },

  async crearPie({ mensaje }) {
    const { data, error } = await supabase
      .from("pies_factura")
      .insert([{ mensaje }])
      .select(COLUMNAS)
      .single();

    if (error)
      throw new Error("Error al crear el pie de factura: " + error.message);
    return data;
  },

  async actualizarPie(id, { mensaje }) {
    const { data, error } = await supabase
      .from("pies_factura")
      .update({ mensaje })
      .eq("id", id)
      .select(COLUMNAS)
      .single();

    if (error)
      throw new Error("Error al actualizar el pie de factura: " + error.message);
    return data;
  },

  async toggleEstado(id, nuevoEstado) {
    const { data, error } = await supabase
      .from("pies_factura")
      .update({ estado: nuevoEstado })
      .eq("id", id)
      .select(COLUMNAS)
      .single();

    if (error)
      throw new Error(
        "Error al cambiar el estado del pie de factura: " + error.message,
      );
    return data;
  },

  /** Borrado lógico: el mensaje deja de imprimirse y de listarse. */
  async eliminarPie(id) {
    const { error } = await supabase
      .from("pies_factura")
      .update({ eliminado: new Date().toISOString() })
      .eq("id", id);

    if (error)
      throw new Error("Error al eliminar el pie de factura: " + error.message);
  },
};
