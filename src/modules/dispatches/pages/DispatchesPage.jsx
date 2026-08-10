import React, { useState, useEffect } from "react";
import { dispatchService } from "../services/dispatchService";
import {
  Truck,
  Search,
  PlusCircle,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export const DispatchesPage = () => {
  const [despachos, setDespachos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Paginación y Búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  // Efecto para el Debounce de búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Volver a la página 1 al buscar
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Cargar Despachos
  const cargarDespachos = async () => {
    try {
      setLoading(true);
      const {
        data,
        total,
        totalPages: pages,
      } = await dispatchService.getDespachosPaginados(
        currentPage,
        pageSize,
        debouncedSearch,
      );
      setDespachos(data);
      setTotalItems(total);
      setTotalPages(pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDespachos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch]);

  const getStatusBadge = (estado) => {
    const styles = {
      creado: "bg-blue-100 text-blue-800 border-blue-200",
      en_ruta: "bg-amber-100 text-amber-800 border-amber-200",
      completado: "bg-emerald-100 text-emerald-800 border-emerald-200",
      anulado: "bg-red-100 text-red-800 border-red-200",
    };

    const labels = {
      creado: "Creado",
      en_ruta: "En Ruta",
      completado: "Completado",
      anulado: "Anulado",
    };

    return (
      <span
        className={`px-2.5 py-1 text-xs font-medium rounded-full border ${styles[estado] || "bg-gray-100 text-gray-800"}`}
      >
        {labels[estado] || estado}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            Órdenes de Despacho
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestiona y monitorea las rutas de entrega de los vehículos.
          </p>
        </div>
        <button
          onClick={() => alert("Próximo paso: Abrir formulario de creación")} // Lo conectaremos en el siguiente paso
          className="flex items-center gap-2 bg-primary hover:bg-primaryHover text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm w-full sm:w-auto justify-center"
        >
          <PlusCircle className="w-5 h-5" />
          Nuevo Despacho
        </button>
      </div>

      {/* CONTROLES (BÚSQUEDA) */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código de despacho..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* MENSAJES DE ERROR */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-2">
          <XCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* TABLA RESPONSIVA */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading && despachos.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p>Cargando despachos...</p>
          </div>
        ) : despachos.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 text-center">
            <MapPin className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700">
              No se encontraron despachos
            </h3>
            <p className="max-w-sm mt-2">
              {searchTerm
                ? "No hay resultados que coincidan con tu búsqueda."
                : "Aún no has registrado ninguna orden de despacho en el sistema."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <th className="px-6 py-4 font-medium">Código</th>
                  <th className="px-6 py-4 font-medium">Vehículo</th>
                  <th className="px-6 py-4 font-medium">Repartidor</th>
                  <th className="px-6 py-4 font-medium">Fecha Despacho</th>
                  <th className="px-6 py-4 font-medium">Estado</th>
                  <th className="px-6 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {despachos.map((despacho) => (
                  <tr
                    key={despacho.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-700">
                        {despacho.codigo_despacho}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-700">
                        {despacho.vehiculo?.placa || "N/A"}
                      </span>
                      <br />
                      <span className="text-xs text-slate-500">
                        {despacho.vehiculo?.marca || ""}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-700">
                        {despacho.repartidor?.nombre_completo || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {formatDate(despacho.fecha_despacho)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(despacho.estado)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() =>
                          alert(
                            `Próximamente: Detalles del despacho ${despacho.codigo_despacho}`,
                          )
                        }
                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors inline-flex"
                        title="Ver Detalles"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINACIÓN */}
        {!loading && despachos.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-sm text-slate-500">
              Mostrando página{" "}
              <span className="font-medium text-slate-700">{currentPage}</span>{" "}
              de{" "}
              <span className="font-medium text-slate-700">{totalPages}</span> (
              {totalItems} registros)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
