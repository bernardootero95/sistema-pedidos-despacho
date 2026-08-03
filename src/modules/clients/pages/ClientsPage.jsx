import React, { useState, useEffect } from "react";
import { clientService } from "../services/clientService";
import { ClientForm } from "../components/ClientForm";
import {
  Users,
  Search,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit,
  Trash2,
  Building2,
  User,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Sub-componente Modal de Detalles (Solo Lectura)
const ClientDetailsModal = ({ client, onClose }) => {
  if (!client) return null;
  const isNatural = client.tipo_organizacion === "natural";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            {isNatural ? (
              <User className="text-primary w-5 h-5" />
            ) : (
              <Building2 className="text-primary w-5 h-5" />
            )}
            Detalles del Cliente
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase mb-1">
                Identificación
              </p>
              <p className="font-medium text-slate-900">
                {client.tipo_identificacion} {client.numero_identificacion}
                {client.digito_verificacion &&
                  ` - ${client.digito_verificacion}`}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase mb-1">
                Tipo de Organización
              </p>
              <p className="font-medium text-slate-900 capitalize">
                {client.tipo_organizacion}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-500 font-bold uppercase mb-1">
                {isNatural ? "Nombre Completo" : "Razón Social"}
              </p>
              <p className="font-bold text-slate-900 text-base">
                {isNatural
                  ? [
                      client.primer_nombre,
                      client.otros_nombres,
                      client.primer_apellido,
                      client.otros_apellidos,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : client.razon_social}
              </p>
              {!isNatural && client.nombre_comercial && (
                <p className="text-slate-500 text-xs mt-0.5">
                  Nombre Comercial: {client.nombre_comercial}
                </p>
              )}
            </div>
            <div className="col-span-2 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500 font-bold uppercase mb-1">
                Contacto y Ubicación
              </p>
              <p className="font-medium text-slate-900 flex items-center gap-2 mt-2">
                <span className="w-20 text-slate-500 text-xs">Ubicación:</span>{" "}
                {client.ciudad_municipio}
              </p>
              <p className="font-medium text-slate-900 flex items-center gap-2 mt-1">
                <span className="w-20 text-slate-500 text-xs">Dirección:</span>{" "}
                {client.direccion}
              </p>
              <p className="font-medium text-slate-900 flex items-center gap-2 mt-1">
                <span className="w-20 text-slate-500 text-xs">Teléfono:</span>{" "}
                {client.telefono || "N/A"}
              </p>
              <p className="font-medium text-slate-900 flex items-center gap-2 mt-1">
                <span className="w-20 text-slate-500 text-xs">Correo:</span>{" "}
                {client.correo || "N/A"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ClientsPage = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Paginación y Búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  // Estados de modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState(null);
  const [clientToView, setClientToView] = useState(null);

  // Efecto Debounce para no saturar la base de datos al escribir
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Volver a la página 1 al realizar una nueva búsqueda
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const cargarClientes = async () => {
    try {
      setLoading(true);
      const {
        data,
        total,
        totalPages: pages,
      } = await clientService.getClientesPaginados(
        currentPage,
        pageSize,
        debouncedSearch,
      );
      setClientes(data);
      setTotalItems(total);
      setTotalPages(pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch]);

  const getDisplayName = (client) => {
    if (client.tipo_organizacion === "juridica") return client.razon_social;
    return [
      client.primer_nombre,
      client.otros_nombres,
      client.primer_apellido,
      client.otros_apellidos,
    ]
      .filter(Boolean)
      .join(" ");
  };

  const handleOpenForm = (client = null) => {
    setClientToEdit(client);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setClientToEdit(null);
    cargarClientes();
  };

  const handleToggleEstado = async (id, estadoActual) => {
    try {
      setClientes((prev) =>
        prev.map((c) => (c.id === id ? { ...c, estado: !estadoActual } : c)),
      );
      await clientService.toggleEstado(id, !estadoActual);
    } catch (err) {
      alert(err.message);
      cargarClientes();
    }
  };

  const handleEliminar = async (id, nombre) => {
    if (!window.confirm(`¿Seguro que deseas eliminar a ${nombre}?`)) return;
    try {
      setClientes((prev) => prev.filter((c) => c.id !== id));
      await clientService.eliminarCliente(id);
      cargarClientes(); // Recargar para ajustar la paginación
    } catch (err) {
      alert(err.message);
      cargarClientes();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 relative">
      {/* MODALES */}
      {isFormOpen && (
        <ClientForm
          clientToEdit={clientToEdit}
          onSuccess={handleFormSuccess}
          onCancel={() => setIsFormOpen(false)}
        />
      )}
      <ClientDetailsModal
        client={clientToView}
        onClose={() => setClientToView(null)}
      />

      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary shrink-0" />
            <span>Directorio de Clientes</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestión centralizada de personas naturales y jurídicas.
          </p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-bold rounded-xl sm:rounded-lg shadow-sm transition-all"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold">
          {error}
        </div>
      )}

      {/* BÚSQUEDA */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-3">
        <Search className="w-5 h-5 text-slate-400 ml-1 sm:ml-2 shrink-0" />
        <input
          type="text"
          placeholder="Buscar por nombre, documento o correo (Enter no es necesario)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent border-none text-base sm:text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium py-1"
        />
        {loading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
      </div>

      {/* TABLA DE RESULTADOS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-200">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">Cliente / Razón Social</th>
                <th className="py-3.5 px-6">Identificación</th>
                <th className="py-3.5 px-6">Ubicación</th>
                <th className="py-3.5 px-6">Estado</th>
                <th className="py-3.5 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {clientes.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    No se encontraron clientes.
                  </td>
                </tr>
              )}
              {clientes.map((client) => (
                <tr
                  key={client.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-4 px-6">
                    <p className="font-bold text-slate-900">
                      {getDisplayName(client)}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                      {client.tipo_organizacion === "juridica" ? (
                        <Building2 className="w-3 h-3 text-primary" />
                      ) : (
                        <User className="w-3 h-3 text-primary" />
                      )}
                      {client.tipo_organizacion}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-bold text-slate-700">
                      {client.tipo_identificacion}{" "}
                      {client.numero_identificacion}
                    </p>
                    {client.digito_verificacion && (
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">
                        DV: {client.digito_verificacion}
                      </p>
                    )}
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    <p className="text-xs font-semibold">
                      {client.ciudad_municipio}
                    </p>
                    <p
                      className="text-[10px] text-slate-400 mt-0.5 truncate max-w-37.5"
                      title={client.direccion}
                    >
                      {client.direccion}
                    </p>
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${client.estado ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
                    >
                      {client.estado ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Activo
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" /> Inactivo
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setClientToView(client)}
                        title="Ver detalles"
                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleToggleEstado(client.id, client.estado)
                        }
                        title={client.estado ? "Suspender" : "Activar"}
                        className={`p-2 rounded-lg transition-colors ${client.estado ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"}`}
                      >
                        {client.estado ? (
                          <XCircle className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenForm(client)}
                        title="Editar"
                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleEliminar(client.id, getDisplayName(client))
                        }
                        title="Eliminar"
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

        {/* CONTROLES DE PAGINACIÓN */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-sm">
            <span className="text-slate-500 font-medium">
              Mostrando página {currentPage} de {totalPages}{" "}
              <span className="hidden sm:inline">({totalItems} registros)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
