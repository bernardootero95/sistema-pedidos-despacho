import React from "react";
import { DEMO_DATA } from "../../../mock/demoData";
import { Truck, PlusCircle, User, Weight, CheckCircle2 } from "lucide-react";

export const VehiclesPage = () => {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* CABECERA TOUCH-OPTIMIZED */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary flex-shrink-0" />
            <span>Flota de Reparto</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
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
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-semibold rounded-xl sm:rounded-lg shadow-sm transition-all min-h-[44px]"
        >
          <PlusCircle className="w-4 h-4 flex-shrink-0" />
          <span>Registrar Vehículo</span>
        </button>
      </div>

      {/* GRILLA DE VEHÍCULOS ADAPTABLE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {DEMO_DATA.vehiculos.map((vehiculo) => (
          <div
            key={vehiculo.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2.5 bg-primary rounded-lg text-white font-black flex-shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider block truncate">
                    Placa / Matrícula
                  </span>
                  <h3 className="text-lg sm:text-xl font-mono font-black tracking-wide text-white truncate">
                    {vehiculo.placa}
                  </h3>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center gap-1 flex-shrink-0">
                <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> Operativo
              </span>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Marca / Modelo
                </span>
                <p className="font-bold text-slate-800 text-sm sm:text-base">
                  {vehiculo.marca}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-3 border-t border-slate-100">
                <div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Weight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />{" "}
                    Capacidad
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm sm:text-base">
                    {vehiculo.capacidad_kg} KG
                  </p>
                </div>

                <div className="overflow-hidden">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1 truncate">
                    <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />{" "}
                    Conductor
                  </span>
                  <p
                    className={`font-semibold text-xs sm:text-sm truncate ${vehiculo.conductor === "Pendiente" ? "text-amber-600 italic" : "text-slate-800"}`}
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
