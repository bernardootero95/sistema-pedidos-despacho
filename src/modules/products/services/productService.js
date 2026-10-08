import { supabase } from "../../../config/supabase";
import { obtenerTodasLasFilas } from "../../../utils/obtenerTodasLasFilas";

/**
 * productos.disponible es NUMERIC: PostgREST lo serializa como string para
 * no perder precisión, igual que ya pasa con precio_venta/total. Se
 * normaliza acá (frontera con Supabase) para que el resto de la app pueda
 * sumar/restar sobre `disponible` con seguridad, sin que cada consumidor
 * tenga que acordarse de envolverlo en Number().
 */
const normalizarProducto = (producto) =>
  producto
    ? {
        ...producto,
        disponible: Number(producto.disponible),
      }
    : producto;

/**
 * El costo de compra vive en `productos_costos` (RLS: solo soporte/gerencia/
 * despachador), no en `productos`, para que el catálogo que leen vendedor/
 * cajera/repartidor no lo exponga. Se embebe solo donde se muestra y se
 * aplana a `ultimo_costo`; a un rol sin acceso el embed le llega en null.
 */
const normalizarProductoConCosto = ({ costo, ...producto }) => ({
  ...normalizarProducto(producto),
  ultimo_costo: costo?.ultimo_costo != null ? Number(costo.ultimo_costo) : null,
});

export const productService = {
  /**
   * Obtiene la lista de productos con paginación y búsqueda (Server-Side)
   */
  async getProductosPaginados(page = 1, limit = 10, searchTerm = "") {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("productos")
      .select("*, costo:productos_costos(ultimo_costo)", { count: "exact" })
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
      data: (data || []).map(normalizarProductoConCosto),
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
    const { data, error } = await obtenerTodasLasFilas(() =>
      supabase
        .from("productos")
        .select("id, nombre, codigo, precio_venta, iva, inc, disponible")
        .is("eliminado", null)
        .order("codigo", { ascending: true })
        .order("id", { ascending: true }),
    );

    if (error)
      throw new Error(
        "Error al cargar la lista de productos: " + error.message,
      );
    return (data || []).map(normalizarProducto);
  },

  /**
   * Franjas de precio al por mayor activas de TODOS los productos, para
   * armar un pedido (Nuevo Pedido/Editar Pedido). Sin filtrar por
   * producto_id porque el buscador ya trae el catálogo completo en
   * memoria; agrupar acá sería una vuelta extra por cada producto.
   */
  async getTodosPreciosMayoristas() {
    const { data, error } = await obtenerTodasLasFilas(() =>
      supabase
        .from("productos_precios_mayoristas")
        .select("producto_id, cantidad_minima, precio")
        .eq("estado", true)
        .is("eliminado", null)
        .order("cantidad_minima", { ascending: true })
        .order("id", { ascending: true }),
    );

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
   * Precios diferenciados (frío, crédito, etc.) de TODOS los productos, con
   * el nombre y los roles permitidos de cada tipo, para armar un pedido y
   * para los indicadores del catálogo. Solo tipos vigentes (activos y no
   * eliminados). Sin filtrar por producto_id por el mismo motivo que
   * getTodosPreciosMayoristas: el catálogo ya está completo en memoria.
   */
  async getTodosPreciosPersonalizados() {
    const { data, error } = await obtenerTodasLasFilas(() =>
      supabase
        .from("productos_precios")
        .select(
          "producto_id, tipo_precio_id, precio, tipo:tipos_precio(nombre, roles_permitidos, estado, eliminado)",
        )
        .eq("estado", true)
        .is("eliminado", null)
        .order("id", { ascending: true }),
    );

    if (error)
      throw new Error(
        "Error al cargar los precios diferenciados: " + error.message,
      );

    return (data || [])
      .filter((fila) => fila.tipo?.estado && !fila.tipo.eliminado)
      .map((fila) => ({
        producto_id: fila.producto_id,
        tipo_precio_id: fila.tipo_precio_id,
        precio: Number(fila.precio),
        nombre: fila.tipo.nombre,
        roles_permitidos: fila.tipo.roles_permitidos,
      }));
  },

  /**
   * Valor de cada tipo de precio configurado para un producto puntual, para
   * precargar el formulario de edición.
   */
  async getPreciosPersonalizados(productoId) {
    const { data, error } = await supabase
      .from("productos_precios")
      .select("tipo_precio_id, precio")
      .eq("producto_id", productoId)
      .eq("estado", true)
      .is("eliminado", null);

    if (error)
      throw new Error(
        "Error al cargar los precios diferenciados: " + error.message,
      );
    return (data || []).map((fila) => ({
      tipo_precio_id: fila.tipo_precio_id,
      precio: Number(fila.precio),
    }));
  },

  /**
   * Reemplaza los precios diferenciados de un producto para los tipos que el
   * formulario administró (`tiposGestionadosIds`): borra los de esos tipos e
   * inserta los que traen valor en `precios`. Los tipos que el formulario no
   * mostró (ej. uno desactivado después) no se tocan. CRUD directo bajo RLS,
   * igual que reemplazarPreciosMayoristas.
   */
  async reemplazarPreciosPersonalizados(
    productoId,
    tiposGestionadosIds,
    precios,
  ) {
    if (tiposGestionadosIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("productos_precios")
        .delete()
        .eq("producto_id", productoId)
        .in("tipo_precio_id", tiposGestionadosIds);

      if (deleteError)
        throw new Error(
          "Error al actualizar los precios diferenciados: " +
            deleteError.message,
        );
    }

    if (precios.length === 0) return;

    const { error: insertError } = await supabase
      .from("productos_precios")
      .insert(
        precios.map((p) => ({
          producto_id: productoId,
          tipo_precio_id: p.tipo_precio_id,
          precio: p.precio,
        })),
      );

    if (insertError)
      throw new Error(
        "Error al guardar los precios diferenciados: " + insertError.message,
      );
  },

  /**
   * Sugiere el próximo código consecutivo disponible para un producto nuevo.
   */
  async getSiguienteCodigo() {
    const { data, error } = await supabase.rpc(
      "obtener_siguiente_codigo_producto",
    );
    if (error) throw new Error("Error al calcular el siguiente código: " + error.message);
    return data;
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

    return normalizarProducto(data);
  },

  /**
   * Fija el costo de compra de un producto en `productos_costos` (tabla con
   * RLS propia, sin escritura directa). La próxima compra registrada lo
   * sobrescribe, igual que cualquier "último costo".
   */
  async asignarCostoProducto(productoId, costo) {
    const { error } = await supabase.rpc("asignar_costo_producto", {
      p_producto_id: productoId,
      p_costo: costo,
    });

    if (error) throw new Error("Error al guardar el costo: " + error.message);
  },

  /**
   * Fija el costo de varios productos en una sola transacción (todos o
   * ninguno). `costos` es un array de { productoId, costo }.
   */
  async asignarCostosProductos(costos) {
    const { data, error } = await supabase.rpc("asignar_costos_productos", {
      p_costos: costos.map((c) => ({ producto_id: c.productoId, costo: c.costo })),
    });

    if (error) throw new Error("Error al guardar los costos: " + error.message);
    return data;
  },

  /**
   * Actualiza solo el precio de venta de un producto. Usado por roles con
   * acceso restringido (despachador): la RPC nunca toca stock ni el resto
   * de la ficha, sin importar qué se le mande. Los precios diferenciados
   * van aparte (reemplazarPreciosPersonalizados).
   */
  async actualizarPreciosProducto(id, { precio_venta }) {
    const { data, error } = await supabase.rpc("actualizar_precios_producto", {
      p_id: id,
      p_precio_venta: precio_venta,
    });

    if (error) throw new Error(error.message);
    return normalizarProducto(data);
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

    return normalizarProducto(data);
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
    return normalizarProducto(data);
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
    return normalizarProducto(data);
  },

  /**
   * Carga masiva desde el Excel del ERP (sincronización manual mientras no
   * esté lista la automática). Vía RPC transaccional `importar_productos_excel`,
   * restringida a soporte en el servidor: si el producto ya existe solo
   * actualiza precio y `disponible` (y el costo si viene); si no existe lo
   * crea. Sin `codigo` (Excel de Tiendana) busca por nombre y, si es nuevo,
   * le asigna el siguiente consecutivo numérico.
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
