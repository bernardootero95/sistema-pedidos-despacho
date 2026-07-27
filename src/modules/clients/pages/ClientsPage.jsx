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

  // Filtrado en tiempo real (SOLID: Lógica de presentación aislada)
  const filteredClients = DEMO_DATA.clientes.filter(
    (client) =>
      client.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.ciudad.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* CABECERA Y ACCIONES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Directorio de Clientes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestión comercial y puntos de entrega para la empresa activa.
          </p>
        </div>
        <button
          onClick={() =>
            alert(
              "En el modo demostración, la creación de clientes se habilitará en la integración con Supabase.",
            )
          }
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400 ml-2" />
        <input
          type="text"
          placeholder="Buscar cliente por nombre o ciudad..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent border-none text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 bg-slate-100 rounded font-semibold"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* TABLA DE CLIENTES */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
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
                      <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        <Building className="w-4 h-4" />
                      </div>
                      {cliente.nombre}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-700">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {cliente.ciudad}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium">
                      {cliente.direccion}
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {cliente.telefono}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Activo
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
