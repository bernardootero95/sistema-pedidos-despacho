import { supabase } from "../../../config/supabase";

export const productService = {
  /**
   * Obtiene la lista de productos con paginación y búsqueda (Server-Side)
   */
  async getProductosPaginados(page = 1, limit = 10, searchTerm = "") {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("productos")
      .select("*", { count: "exact" })
      .is("eliminado", null)
      .order("creado", { ascending: false });

    // Búsqueda por código, código de barras o nombre
    if (searchTerm) {
      query = query.or(
        `codigo.ilike.%${searchTerm}%,codigo_barra.ilike.%${searchTerm}%,nombre.ilike.%${searchTerm}%`,
      );
    }

    const { data, error, count } = await query.range(from, to);

    if (error)
      throw new Error(
        "Error al cargar la lista de productos: " + error.message,
      );

    return {
      data,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  },

  /**
   * Obtiene todos los productos activos sin paginar, para selectores (ej. el
   * buscador de productos en Nuevo Pedido). No usar para listados con
   * tabla: para eso está getProductosPaginados.
   */
  async getProductosActivos() {
    const { data, error } = await supabase
      .from("productos")
      .select(
        "id, nombre, codigo, precio_venta, iva, inc, disponible, precio_frio",
      )
      .is("eliminado", null)
      .order("codigo", { ascending: true });

    if (error)
      throw new Error(
        "Error al cargar la lista de productos: " + error.message,
      );
    return data || [];
  },

  /**
   * Franjas de precio al por mayor activas de TODOS los productos, para
   * armar un pedido (Nuevo Pedido/Editar Pedido). Sin filtrar por
   * producto_id porque el buscador ya trae el catálogo completo en
   * memoria; agrupar acá sería una vuelta extra por cada producto.
   */
  async getTodosPreciosMayoristas() {
    const { data, error } = await supabase
      .from("productos_precios_mayoristas")
      .select("producto_id, cantidad_minima, precio")
      .eq("estado", true)
      .is("eliminado", null)
      .order("cantidad_minima", { ascending: true });

    if (error)
      throw new Error(
        "Error al cargar los precios al por mayor: " + error.message,
      );
    return data || [];
  },

  /**
   * Franjas de precio al por mayor de un producto puntual, para precargar
   * el formulario de edición.
   */
  async getPreciosMayoristas(productoId) {
    const { data, error } = await supabase
      .from("productos_precios_mayoristas")
      .select("id, cantidad_minima, precio")
      .eq("producto_id", productoId)
      .eq("estado", true)
      .is("eliminado", null)
      .order("cantidad_minima", { ascending: true });

    if (error)
      throw new Error(
        "Error al cargar los precios al por mayor: " + error.message,
      );
    return data || [];
  },

  /**
   * Reemplaza el set completo de franjas de precio al por mayor de un
   * producto: borra las que ya no vienen en `tiers` e inserta el resto.
   * No es una operación crítica (rule 6 de CLAUDE.md aplica a dinero en
   * vuelo de un pedido, no a la configuración del catálogo — igual que
   * crearProducto/actualizarProducto, es un CRUD directo bajo RLS).
   */
  async reemplazarPreciosMayoristas(productoId, tiers) {
    const { error: deleteError } = await supabase
      .from("productos_precios_mayoristas")
      .delete()
      .eq("producto_id", productoId);

    if (deleteError)
      throw new Error(
        "Error al actualizar los precios al por mayor: " +
          deleteError.message,
      );

    if (tiers.length === 0) return;

    const { error: insertError } = await supabase
      .from("productos_precios_mayoristas")
      .insert(
        tiers.map((t) => ({
          producto_id: productoId,
          cantidad_minima: t.cantidad_minima,
          precio: t.precio,
        })),
      );

    if (insertError)
      throw new Error(
        "Error al guardar los precios al por mayor: " + insertError.message,
      );
  },

  /**
   * Crea un nuevo producto
   */
  async crearProducto(productoData) {
    const { data, error } = await supabase
      .from("productos")
      .insert([productoData])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Ya existe un producto registrado con ese código.");
      }
      throw new Error("Error al crear el producto: " + error.message);
    }

    return data;
  },

  /**
   * Actualiza un producto existente
   */
  async actualizarProducto(id, productoData) {
    const dataToUpdate = {
      ...productoData,
      actualizado: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("productos")
      .update(dataToUpdate)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "El código ingresado ya está en uso por otro producto.",
        );
      }
      throw new Error("Error al actualizar el producto: " + error.message);
    }

    return data;
  },

  /**
   * Alterna el estado activo/inactivo (Suspensión)
   */
  async toggleEstado(id, nuevoEstado) {
    const { data, error } = await supabase
      .from("productos")
      .update({ estado: nuevoEstado, actualizado: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error)
      throw new Error(
        "Error al cambiar el estado del producto: " + error.message,
      );
    return data;
  },

  /**
   * Realiza un borrado lógico (Soft Delete)
   */
  async eliminarProducto(id) {
    const { data, error } = await supabase
      .from("productos")
      .update({ eliminado: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error)
      throw new Error("Error al eliminar el producto: " + error.message);
    return data;
  },

  /**
   * Carga masiva desde el Excel del ERP (sincronización manual mientras no
   * esté lista la automática). Vía RPC transaccional `importar_productos_excel`,
   * restringida a soporte en el servidor: si el código ya existe solo
   * actualiza `disponible`, si no existe lo crea como gravado con IVA 19%.
   */
  async importarProductosExcel(productos) {
    const { data, error } = await supabase.rpc("importar_productos_excel", {
      p_productos: productos,
    });

    if (error) {
      throw new Error("Error al importar los productos: " + error.message);
    }

    return {
      creados: data?.creados ?? 0,
      actualizados: data?.actualizados ?? 0,
    };
  },
};
