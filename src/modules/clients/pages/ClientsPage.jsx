import React, { useState } from "react";
import { DEMO_DATA } from "../../../mock/demoData";
import {
  Users,
  Search,
  MapPin,
  Phone,
  Building,
  PlusCircle,
  CheckCircle2,
} from "lucide-react";

export const ClientsPage = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = DEMO_DATA.clientes.filter(
    (client) =>
      client.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.ciudad.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary flex-shrink-0" />
            <span>Directorio de Clientes</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestión comercial y puntos de entrega para la empresa activa.
          </p>
        </div>
        <button
          onClick={() =>
            alert(
              "En el modo demostración, la creación de clientes se habilitará en la integración con Supabase.",
            )
          }
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-semibold rounded-xl sm:rounded-lg shadow-sm transition-all min-h-[44px]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA TOUCH-OPTIMIZED */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-3">
        <Search className="w-5 h-5 text-slate-400 ml-1 sm:ml-2 flex-shrink-0" />
        <input
          type="text"
          placeholder="Buscar por nombre o ciudad..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent border-none text-base sm:text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium py-1"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 bg-slate-100 rounded-lg font-semibold flex-shrink-0"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* LISTADO DE CLIENTES */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* VISTA MÓVIL (TARJETAS) */}
        <div className="block sm:hidden divide-y divide-slate-200">
          {filteredClients.length > 0 ? (
            filteredClients.map((cliente) => (
              <div key={cliente.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg flex-shrink-0">
                      <Building className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm leading-snug">
                      {cliente.nombre}
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> Activo
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pl-8">
                  <p className="flex items-center gap-1.5 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>
                      {cliente.ciudad} — {cliente.direccion}
                    </span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>{cliente.telefono}</span>
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-slate-500 text-sm font-medium px-4">
              No se encontraron clientes con el criterio "{searchTerm}".
            </div>
          )}
        </div>

        {/* VISTA ESCRITORIO (TABLA) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">ID</th>
                <th className="py-3.5 px-6">Razón Social / Nombre</th>
                <th className="py-3.5 px-6">Ciudad / Ubicación</th>
                <th className="py-3.5 px-6">Dirección de Despacho</th>
                <th className="py-3.5 px-6">Teléfono de Contacto</th>
                <th className="py-3.5 px-6">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredClients.length > 0 ? (
                filteredClients.map((cliente) => (
                  <tr
                    key={cliente.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-4 px-6 font-bold text-slate-400">
                      #{cliente.id}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900 flex items-center gap-2.5">
                      <div className="p-2 bg-primary/10 text-primary rounded-lg flex-shrink-0">
                        <Building className="w-4 h-4" />
                      </div>
                      <span>{cliente.nombre}</span>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-700">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        {cliente.ciudad}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium">
                      {cliente.direccion}
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        {cliente.telefono}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" />{" "}
                        Activo
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="py-8 text-center text-slate-500 font-medium"
                  >
                    No se encontraron clientes con el criterio "{searchTerm}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
