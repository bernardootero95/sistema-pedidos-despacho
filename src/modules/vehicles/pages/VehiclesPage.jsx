import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { vehicleService } from "../services/vehicleService";
import {
  Truck,
  Search,
  PlusCircle,
  UserCheck,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

export const VehiclesPage = () => {
  const navigate = useNavigate();
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Paginación y Búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  // Debounce para optimizar las consultas a la base de datos
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Cargar lista paginada
  const cargarVehiculos = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await vehicleService.getVehiculosPaginados(
        currentPage,
        pageSize,
        debouncedSearch,
      );
      setVehiculos(res.data);
      setTotalPages(res.totalPages);
      setTotalItems(res.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarVehiculos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch]);

  const handleToggleEstado = async (id, estadoActual) => {
    try {
      setVehiculos((prev) =>
        prev.map((v) => (v.id === id ? { ...v, estado: !estadoActual } : v)),
      );
      await vehicleService.toggleEstado(id, !estadoActual);
    } catch (err) {
      alert(err.message);
      cargarVehiculos();
    }
  };

  const handleEliminar = async (id, placa) => {
    if (
      !window.confirm(
        `¿Seguro que deseas eliminar el vehículo con placa "${placa}"?`,
      )
    )
      return;
    try {
      setVehiculos((prev) => prev.filter((v) => v.id !== id));
      await vehicleService.eliminarVehiculo(id);
      cargarVehiculos();
    } catch (err) {
      alert(err.message);
      cargarVehiculos();
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-7 h-7 text-blue-600" />
            Flota de Vehículos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestión y asignación de unidades de transporte a repartidores.
          </p>
        </div>
        <button
          onClick={() => navigate("/vehiculos/nuevo")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Nuevo Vehículo</span>
        </button>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por placa, marca o modelo..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 transition-colors"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Total registros:{" "}
          <span className="text-slate-800 font-bold">{totalItems}</span>
        </div>
      </div>

      {/* Alerta de Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabla y Tarjetas de Vehículos */}
      {loading && vehiculos.length === 0 ? (
        <div className="flex justify-center items-center h-64 text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span>Cargando flota de vehículos...</span>
        </div>
      ) : vehiculos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">
            No se encontraron vehículos
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {debouncedSearch
              ? "No hay unidades que coincidan con el término de búsqueda."
              : "Comienza registrando una nueva unidad en la flota."}
          </p>
        </div>
      ) : (
        <>
          {/* Vista Tabla Desktop */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Placa</th>
                  <th className="py-3.5 px-4">Marca / Modelo</th>
                  <th className="py-3.5 px-4">Conductor (Repartidor)</th>
                  <th className="py-3.5 px-4">Capacidades</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {vehiculos.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900 tracking-wider uppercase">
                      {v.placa}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-800">
                        {v.marca}
                      </span>{" "}
                      <span className="text-slate-400">({v.modelo})</span>
                    </td>
                    <td className="py-3.5 px-4">
                      {v.conductor ? (
                        <div className="flex items-center gap-2 text-slate-800">
                          <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="font-medium">
                            {v.conductor.nombre_completo}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">
                          Sin conductor asignado
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 space-y-0.5">
                      <div>
                        <span className="font-medium text-slate-700">
                          Peso:
                        </span>{" "}
                        {v.capacidad_peso ? `${v.capacidad_peso} kg` : "N/A"}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">
                          Volumen:
                        </span>{" "}
                        {v.capacidad_volumen
                          ? `${v.capacidad_volumen} m³`
                          : "N/A"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleEstado(v.id, v.estado)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          v.estado
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {v.estado ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Activo</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            <span>Inactivo</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/vehiculos/editar/${v.id}`)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar Vehículo"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEliminar(v.id, v.placa)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar Vehículo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vista Tarjetas Mobile */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {vehiculos.map((v) => (
              <div
                key={v.id}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-slate-900 tracking-wider text-base uppercase">
                      {v.placa}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleEstado(v.id, v.estado)}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      v.estado
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {v.estado ? "Activo" : "Inactivo"}
                  </button>
                </div>

                <div className="text-xs text-slate-600 space-y-1.5">
                  <div>
                    <span className="font-semibold text-slate-700">
                      Marca / Modelo:
                    </span>{" "}
                    {v.marca} ({v.modelo})
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">
                      Conductor:
                    </span>{" "}
                    {v.conductor ? (
                      <span className="text-blue-700 font-medium">
                        {v.conductor.nombre_completo}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Sin asignar</span>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">
                      Capacidades:
                    </span>{" "}
                    {v.capacidad_peso ? `${v.capacidad_peso} kg` : "N/A"} |{" "}
                    {v.capacidad_volumen ? `${v.capacidad_volumen} m³` : "N/A"}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => navigate(`/vehiculos/editar/${v.id}`)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5 text-blue-600" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleEliminar(v.id, v.placa)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Controles de Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-xs text-slate-500">
                Página{" "}
                <span className="font-bold text-slate-800">{currentPage}</span>{" "}
                de{" "}
                <span className="font-bold text-slate-800">{totalPages}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
