import React from "react";
import { DEMO_DATA } from "../../../mock/demoData";
import { Truck, PlusCircle, User, Weight, CheckCircle2 } from "lucide-react";

export const VehiclesPage = () => {
  return (
    <div className="space-y-6">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            Flota de Vehículos de Reparto
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Administración de transportes, capacidades máximas de carga y
            asignación de conductores.
          </p>
        </div>
        <button
          onClick={() =>
            alert(
              "El alta de vehículos estará disponible en la integración backend.",
            )
          }
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Registrar Vehículo</span>
        </button>
      </div>

      {/* GRILLA DE VEHÍCULOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {DEMO_DATA.vehiculos.map((vehiculo) => (
          <div
            key={vehiculo.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between"
          >
            <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary rounded-lg text-white font-black">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                    Placa / Matrícula
                  </span>
                  <h3 className="text-xl font-mono font-black tracking-wide text-white">
                    {vehiculo.placa}
                  </h3>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Operativo
              </span>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Marca / Modelo
                </span>
                <p className="font-bold text-slate-800 text-base">
                  {vehiculo.marca}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Weight className="w-3.5 h-3.5 text-slate-400" /> Capacidad
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm">
                    {vehiculo.capacidad_kg} KG
                  </p>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Conductor
                  </span>
                  <p
                    className={`font-semibold text-sm truncate ${vehiculo.conductor === "Pendiente" ? "text-amber-600 italic" : "text-slate-800"}`}
                  >
                    {vehiculo.conductor}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
