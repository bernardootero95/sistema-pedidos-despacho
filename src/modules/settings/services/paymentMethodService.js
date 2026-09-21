import { supabase } from "../../../config/supabase";

const COLUMNAS = "id, nombre, codigo_dian, es_efectivo, estado";

export const paymentMethodService = {
  /**
   * Catálogo de métodos de pago (sin borrados lógicos). Catálogo pequeño, no
   * se pagina. `soloActivos` lo usan los diálogos de cobro, que solo ofrecen
   * métodos vigentes. Efectivo va primero, luego alfabético.
   */
  async getMetodosPago({ soloActivos = false } = {}) {
    let query = supabase
      .from("metodos_pago")
      .select(COLUMNAS)
      .is("eliminado", null)
      .order("es_efectivo", { ascending: false })
      .order("nombre", { ascending: true });

    if (soloActivos) query = query.eq("estado", true);

    const { data, error } = await query;

    if (error)
      throw new Error("Error al cargar los métodos de pago: " + error.message);
    return data || [];
  },

  async crearMetodoPago({ nombre, codigo_dian }) {
    const { data, error } = await supabase
      .from("metodos_pago")
      .insert([{ nombre, codigo_dian }])
      .select(COLUMNAS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Ya existe un método de pago con ese nombre.");
      }
      throw new Error("Error al crear el método de pago: " + error.message);
    }

    return data;
  },

  async actualizarMetodoPago(id, { nombre, codigo_dian }) {
    const { data, error } = await supabase
      .from("metodos_pago")
      .update({ nombre, codigo_dian })
      .eq("id", id)
      .select(COLUMNAS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Ya existe un método de pago con ese nombre.");
      }
      throw new Error(
        "Error al actualizar el método de pago: " + error.message,
      );
    }

    return data;
  },

  async toggleEstado(id, nuevoEstado) {
    const { data, error } = await supabase
      .from("metodos_pago")
      .update({ estado: nuevoEstado })
      .eq("id", id)
      .select(COLUMNAS)
      .single();

    if (error)
      throw new Error(
        "Error al cambiar el estado del método de pago: " + error.message,
      );
    return data;
  },

  /**
   * Borrado lógico: los pagos ya registrados conservan su referencia
   * (pagos.metodo_pago_id) y siguen mostrando el nombre. El servidor impide
   * eliminar Efectivo.
   */
  async eliminarMetodoPago(id) {
    const { error } = await supabase
      .from("metodos_pago")
      .update({ eliminado: new Date().toISOString() })
      .eq("id", id);

    if (error)
      throw new Error("Error al eliminar el método de pago: " + error.message);
  },
};
