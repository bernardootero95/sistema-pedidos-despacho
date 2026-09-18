import { supabase } from "../../../config/supabase";

const COLUMNAS = "id, nombre, roles_permitidos, estado";

export const priceTypeService = {
  /**
   * Catálogo completo de tipos de precio (sin borrados lógicos). Es un
   * catálogo pequeño, así que no se pagina. `soloActivos` lo usan los
   * formularios de producto y el carrito, que solo ofrecen tipos vigentes.
   */
  async getTiposPrecio({ soloActivos = false } = {}) {
    let query = supabase
      .from("tipos_precio")
      .select(COLUMNAS)
      .is("eliminado", null)
      .order("nombre", { ascending: true });

    if (soloActivos) query = query.eq("estado", true);

    const { data, error } = await query;

    if (error)
      throw new Error("Error al cargar los tipos de precio: " + error.message);
    return data || [];
  },

  async crearTipoPrecio({ nombre, roles_permitidos }) {
    const { data, error } = await supabase
      .from("tipos_precio")
      .insert([{ nombre, roles_permitidos }])
      .select(COLUMNAS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Ya existe un tipo de precio con ese nombre.");
      }
      throw new Error("Error al crear el tipo de precio: " + error.message);
    }

    return data;
  },

  async actualizarTipoPrecio(id, { nombre, roles_permitidos }) {
    const { data, error } = await supabase
      .from("tipos_precio")
      .update({
        nombre,
        roles_permitidos,
        actualizado: new Date().toISOString(),
      })
      .eq("id", id)
      .select(COLUMNAS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Ya existe un tipo de precio con ese nombre.");
      }
      throw new Error(
        "Error al actualizar el tipo de precio: " + error.message,
      );
    }

    return data;
  },

  async toggleEstado(id, nuevoEstado) {
    const { data, error } = await supabase
      .from("tipos_precio")
      .update({ estado: nuevoEstado, actualizado: new Date().toISOString() })
      .eq("id", id)
      .select(COLUMNAS)
      .single();

    if (error)
      throw new Error(
        "Error al cambiar el estado del tipo de precio: " + error.message,
      );
    return data;
  },

  /**
   * Borrado lógico: los pedidos ya facturados con este tipo conservan su
   * referencia (pedidos_detalle.tipo_precio_id) y siguen mostrando el nombre.
   */
  async eliminarTipoPrecio(id) {
    const { error } = await supabase
      .from("tipos_precio")
      .update({ eliminado: new Date().toISOString() })
      .eq("id", id);

    if (error)
      throw new Error("Error al eliminar el tipo de precio: " + error.message);
  },
};
