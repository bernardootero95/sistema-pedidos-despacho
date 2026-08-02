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
} from "lucide-react";

export const ClientsPage = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Estado para el modal del formulario
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState(null);

  const cargarClientes = async () => {
    try {
      setLoading(true);
      const data = await clientService.getClientes();
      setClientes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  // Helpers para la UI
  const getDisplayName = (client) => {
    if (client.tipo_organizacion === "juridica") {
      return client.razon_social;
    }
    // Para persona natural, unimos los nombres y apellidos omitiendo los nulos o vacíos
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

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setClientToEdit(null);
  };

  const handleFormSuccess = () => {
    handleCloseForm();
    cargarClientes();
  };

  const handleToggleEstado = async (id, estadoActual) => {
    try {
      // Optimistic UI Update
      setClientes((prev) =>
        prev.map((c) => (c.id === id ? { ...c, estado: !estadoActual } : c)),
      );
      await clientService.toggleEstado(id, !estadoActual);
    } catch (err) {
      alert(err.message);
      cargarClientes(); // Revertir en caso de error
    }
  };

  const handleEliminar = async (id, nombre) => {
    if (
      !window.confirm(
        `¿Estás seguro de que deseas eliminar al cliente ${nombre}? Esta acción no se puede deshacer directamente.`,
      )
    ) {
      return;
    }

    try {
      // Optimistic UI Update para eliminación
      setClientes((prev) => prev.filter((c) => c.id !== id));
      await clientService.eliminarCliente(id);
    } catch (err) {
      alert(err.message);
      cargarClientes();
    }
  };

  // Filtrado en tiempo real
  const filteredClients = clientes.filter((c) => {
    const term = searchTerm.toLowerCase();
    const name = getDisplayName(c).toLowerCase();
    const idNum = c.numero_identificacion.toLowerCase();
    const email = (c.correo || "").toLowerCase();

    return name.includes(term) || idNum.includes(term) || email.includes(term);
  });

  if (loading && clientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <p className="text-sm font-semibold">
          Cargando directorio de clientes...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 relative">
      {/* MODAL DEL FORMULARIO */}
      {isFormOpen && (
        <ClientForm
          clientToEdit={clientToEdit}
          onSuccess={handleFormSuccess}
          onCancel={handleCloseForm}
        />
      )}

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
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-bold rounded-xl sm:rounded-lg shadow-sm transition-all min-h-11"
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
          placeholder="Buscar por nombre, razón social, identificación o correo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent border-none text-base sm:text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium py-1"
        />
      </div>

      {/* TABLA DE RESULTADOS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* VISTA MÓVIL */}
        <div className="block sm:hidden divide-y divide-slate-200">
          {filteredClients.length === 0 && !loading && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No se encontraron clientes.
            </div>
          )}
          {filteredClients.map((client) => (
            <div key={client.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm leading-snug">
                    {getDisplayName(client)}
                  </h4>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    {client.tipo_identificacion} {client.numero_identificacion}
                  </p>
                </div>
                <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  {client.tipo_organizacion === "juridica" ? (
                    <Building2 className="w-3 h-3 text-primary" />
                  ) : (
                    <User className="w-3 h-3 text-primary" />
                  )}
                </span>
              </div>

              <div className="text-xs text-slate-600">
                <p>{client.ciudad_municipio}</p>
                {client.telefono && <p className="mt-0.5">{client.telefono}</p>}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span
                  className={`text-xs font-bold flex items-center gap-1 ${client.estado ? "text-emerald-600" : "text-red-500"}`}
                >
                  {client.estado ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Activo
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> Inactivo
                    </>
                  )}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleEstado(client.id, client.estado)}
                    className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    {client.estado ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleOpenForm(client)}
                    className="p-2 text-primary hover:text-primary-hover bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      handleEliminar(client.id, getDisplayName(client))
                    }
                    className="p-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* VISTA ESCRITORIO */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">Cliente</th>
                <th className="py-3.5 px-6">Tipo</th>
                <th className="py-3.5 px-6">Contacto</th>
                <th className="py-3.5 px-6">Estado</th>
                <th className="py-3.5 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredClients.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    No se encontraron clientes en la búsqueda.
                  </td>
                </tr>
              )}
              {filteredClients.map((client) => (
                <tr
                  key={client.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-4 px-6">
                    <p className="font-bold text-slate-900">
                      {getDisplayName(client)}
                    </p>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      {client.tipo_identificacion}{" "}
                      {client.numero_identificacion}
                    </p>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider">
                      {client.tipo_organizacion === "juridica" ? (
                        <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                      {client.tipo_organizacion === "juridica"
                        ? "Jurídica"
                        : "Natural"}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    {client.correo && (
                      <p className="text-xs">{client.correo}</p>
                    )}
                    <p className="text-xs mt-0.5">
                      {client.telefono || "Sin teléfono"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {client.ciudad_municipio}
                    </p>
                  </td>
                  <td className="py-4 px-6">
                    {client.estado ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Activo
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Inactivo
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() =>
                          handleToggleEstado(client.id, client.estado)
                        }
                        title={
                          client.estado
                            ? "Suspender cliente"
                            : "Activar cliente"
                        }
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
                        title="Editar cliente"
                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleEliminar(client.id, getDisplayName(client))
                        }
                        title="Eliminar cliente"
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
      </div>
    </div>
  );
};
