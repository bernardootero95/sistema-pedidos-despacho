import { supabase } from "../../../config/supabase";

export const vehicleService = {
  /**
   * Obtiene la lista de vehículos con paginación, búsqueda e información del conductor asignado
   */
  async getVehiculosPaginados(page = 1, limit = 10, searchTerm = "") {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("vehiculos")
      .select(
        "*, conductor:perfiles!vehiculos_conductor_id_fkey(id, nombre_completo, nombre_usuario)",
        { count: "exact" },
      )
      .is("eliminado", null);

    if (searchTerm.trim() !== "") {
      query = query.or(
        `placa.ilike.%${searchTerm}%,marca.ilike.%${searchTerm}%,modelo.ilike.%${searchTerm}%`,
      );
    }

    const { data, error, count } = await query
      .order("creado", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Error al cargar vehículos: ${error.message}`);
    }

    const total = count || 0;
    return {
      data: data || [],
      total,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Obtiene los datos de un vehículo por su ID
   */
  async getVehiculoPorId(id) {
    const { data, error } = await supabase
      .from("vehiculos")
      .select(
        "*, conductor:perfiles!vehiculos_conductor_id_fkey(id, nombre_completo, nombre_usuario)",
      )
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(`Error al obtener el vehículo: ${error.message}`);
    }

    return { data, error: null };
  },

  /**
   * Obtiene la lista de usuarios activos con el rol de 'repartidor'
   */
  async getRepartidores() {
    const { data, error } = await supabase
      .from("perfiles")
      .select("id, nombre_completo, nombre_usuario, roles!inner(nombre)")
      .eq("roles.nombre", "repartidor")
      .eq("estado", true)
      .is("eliminado", null)
      .order("nombre_completo", { ascending: true });

    if (error) {
      throw new Error(
        `Error al obtener lista de repartidores: ${error.message}`,
      );
    }

    return data || [];
  },

  /**
   * Obtiene vehículos activos con su conductor, marcando con
   * `enRutaActiva` los que ya tienen un despacho sin terminar
   * (estado 'creado' o 'en_ruta'). No se ocultan: se muestran
   * deshabilitados en el selector para que el despachador entienda por
   * qué no puede elegirlos, en vez de que "desaparezcan" sin explicación.
   * La regla real (fuente de verdad) vive en crear_despacho_transaccional;
   * esto es solo para dar feedback inmediato en la UI.
   */
  async getVehiculosDisponibles() {
    const [vehiculosRes, despachosActivosRes] = await Promise.all([
      supabase
        .from("vehiculos")
        .select(
          "id, placa, marca, modelo, capacidad_peso, conductor_id, conductor:perfiles!vehiculos_conductor_id_fkey(nombre_completo)",
        )
        .eq("estado", true)
        .is("eliminado", null)
        .order("placa", { ascending: true }),
      supabase
        .from("despachos")
        .select("vehiculo_id")
        .in("estado", ["creado", "en_ruta"])
        .is("eliminado", null),
    ]);

    if (vehiculosRes.error) {
      throw new Error(
        `Error al obtener vehículos disponibles: ${vehiculosRes.error.message}`,
      );
    }
    if (despachosActivosRes.error) {
      throw new Error(
        `Error al verificar despachos activos: ${despachosActivosRes.error.message}`,
      );
    }

    const idsEnRutaActiva = new Set(
      (despachosActivosRes.data || []).map((d) => d.vehiculo_id),
    );

    return (vehiculosRes.data || []).map((v) => ({
      ...v,
      enRutaActiva: idsEnRutaActiva.has(v.id),
    }));
  },

  /**
   * Crea un nuevo vehículo
   */
  async crearVehiculo(vehiculoData) {
    const { data, error } = await supabase
      .from("vehiculos")
      .insert([vehiculoData])
      .select()
      .single();

    if (error) {
      throw new Error(`Error al registrar el vehículo: ${error.message}`);
    }

    return data;
  },

  /**
   * Actualiza un vehículo existente
   */
  async actualizarVehiculo(id, vehiculoData) {
    const dataToUpdate = {
      ...vehiculoData,
      actualizado: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("vehiculos")
      .update(dataToUpdate)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al actualizar el vehículo: ${error.message}`);
    }

    return data;
  },

  /**
   * Alterna el estado activo/inactivo del vehículo
   */
  async toggleEstado(id, nuevoEstado) {
    const { data, error } = await supabase
      .from("vehiculos")
      .update({
        estado: nuevoEstado,
        actualizado: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Error al cambiar el estado del vehículo: ${error.message}`,
      );
    }

    return data;
  },

  /**
   * Borrado lógico (Soft Delete) del vehículo
   */
  async eliminarVehiculo(id) {
    const { data, error } = await supabase
      .from("vehiculos")
      .update({
        eliminado: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al eliminar el vehículo: ${error.message}`);
    }

    return data;
  },
};
