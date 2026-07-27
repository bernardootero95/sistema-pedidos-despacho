import React, { useState } from "react";
import { DEMO_DATA } from "../../../mock/demoData";
import { useAuth } from "../../../context/AuthContext";
import {
  Truck,
  Plus,
  CheckCircle2,
  Clock,
  Package,
  AlertCircle,
  MapPin,
  UserCheck,
} from "lucide-react";

export const DispatchesPage = () => {
  const { user } = useAuth();

  const [despachos, setDespachos] = useState(DEMO_DATA.despachos);
  const [pedidosPendientes, setPedidosPendientes] = useState(
    DEMO_DATA.pedidos.filter((p) => p.estado === "pendiente"),
  );

  const [activeTab, setActiveTab] = useState("list");
  const [vehiculoPlaca, setVehiculoPlaca] = useState("");
  const [selectedPedidos, setSelectedPedidos] = useState([]);
  const [formErrors, setFormErrors] = useState({});

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSelectPedido = (id) => {
    if (selectedPedidos.includes(id)) {
      setSelectedPedidos(selectedPedidos.filter((item) => item !== id));
    } else {
      setSelectedPedidos([...selectedPedidos, id]);
    }
  };

  const handleSubmitDispatch = (e) => {
    e.preventDefault();
    const errors = {};
    if (!vehiculoPlaca)
      errors.vehiculo = "Debes asignar un vehículo para la ruta.";
    if (selectedPedidos.length === 0)
      errors.pedidos =
        "Selecciona al menos un pedido pendiente para despachar.";

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const vehiculo = DEMO_DATA.vehiculos.find((v) => v.placa === vehiculoPlaca);

    const newDispatch = {
      id: `DSP-${500 + despachos.length + 1}`,
      fecha: new Date().toISOString().split("T")[0],
      vehiculo_placa: vehiculo.placa,
      conductor_nombre: vehiculo.conductor,
      despachador_nombre: user?.nombre_completo || "Despachador Demo",
      estado: "en_ruta",
      pedidos_ids: selectedPedidos,
      total_peso_estimado: `${selectedPedidos.length * 45} kg est.`,
    };

    setDespachos([newDispatch, ...despachos]);
    DEMO_DATA.despachos.unshift(newDispatch);

    DEMO_DATA.pedidos.forEach((p) => {
      if (selectedPedidos.includes(p.id)) {
        p.estado = "despachado";
      }
    });

    setPedidosPendientes(
      pedidosPendientes.filter((p) => !selectedPedidos.includes(p.id)),
    );

    setVehiculoPlaca("");
    setSelectedPedidos([]);
    setFormErrors({});
    setActiveTab("list");
    alert(
      `¡Orden de Despacho ${newDispatch.id} generada y asignada al vehículo ${vehiculo.placa}!`,
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* CABECERA RESPONSIVA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary flex-shrink-0" />
            <span>Órdenes de Despacho</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Agrupación logística de pedidos, asignación de flota de reparto y
            control de rutas.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("list")}
            className={`flex-1 sm:flex-initial py-2 px-4 rounded-md text-xs font-bold transition-all text-center ${
              activeTab === "list"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Rutas Activas ({despachos.length})
          </button>
          <button
            onClick={() => {
              setPedidosPendientes(
                DEMO_DATA.pedidos.filter((p) => p.estado === "pendiente"),
              );
              setActiveTab("new");
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2 px-4 rounded-md text-xs font-bold transition-all ${
              activeTab === "new"
                ? "bg-primary text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Plus className="w-4 h-4 flex-shrink-0" /> Nuevo Despacho
          </button>
        </div>
      </div>

      {/* VISTA 1: RUTAS Y DESPACHOS ACTIVOS */}
      {activeTab === "list" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {despachos.map((dsp) => (
            <div
              key={dsp.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between"
            >
              <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3 overflow-hidden pr-2">
                  <div className="p-2.5 bg-primary/20 text-primary-light rounded-lg font-bold flex-shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-[10px] sm:text-xs text-slate-400 font-bold block uppercase tracking-wider truncate">
                      Orden de Despacho
                    </span>
                    <h3 className="text-base sm:text-lg font-black font-mono text-white truncate">
                      {dsp.id}
                    </h3>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-bold flex items-center gap-1 flex-shrink-0">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" /> En Ruta
                </span>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="overflow-hidden">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5 truncate">
                      Vehículo Asignado
                    </span>
                    <p className="font-bold text-slate-900 font-mono text-sm sm:text-base truncate">
                      {dsp.vehiculo_placa}
                    </p>
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5 truncate">
                      Conductor
                    </span>
                    <p className="font-semibold text-slate-700 text-xs sm:text-sm truncate">
                      {dsp.conductor_nombre}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 flex-shrink-0" /> Pedidos en
                    esta ruta ({dsp.pedidos_ids.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {dsp.pedidos_ids.map((id) => (
                      <span
                        key={id}
                        className="px-2 py-1 bg-slate-100 border border-slate-200 text-slate-800 font-mono text-xs font-bold rounded"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-500 px-4 sm:px-5">
                <span className="truncate">
                  Despachado por:{" "}
                  <strong className="text-slate-700">
                    {dsp.despachador_nombre}
                  </strong>
                </span>
                <span>Fecha: {dsp.fecha}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VISTA 2: ARMAR NUEVO DESPACHO (Formulario Touch-Optimized) */}
      {activeTab === "new" && (
        <form
          onSubmit={handleSubmitDispatch}
          className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm space-y-6"
          noValidate
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pb-6 border-b border-slate-200">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                1. Asignar Vehículo / Conductor
              </label>
              <select
                value={vehiculoPlaca}
                onChange={(e) => {
                  setVehiculoPlaca(e.target.value);
                  setFormErrors((prev) => ({ ...prev, vehiculo: "" }));
                }}
                className={`w-full p-3.5 sm:p-3 bg-slate-50 border rounded-xl sm:rounded-lg text-base sm:text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  formErrors.vehiculo
                    ? "border-red-400 bg-red-50/20"
                    : "border-slate-300"
                }`}
              >
                <option value="">-- Selecciona vehículo de la flota --</option>
                {DEMO_DATA.vehiculos.map((v) => (
                  <option key={v.id} value={v.placa}>
                    {v.placa} - {v.marca} (Cap: {v.capacidad_kg} kg | Conductor:{" "}
                    {v.conductor})
                  </option>
                ))}
              </select>
              {formErrors.vehiculo && (
                <p className="mt-1.5 text-xs font-semibold text-red-600">
                  {formErrors.vehiculo}
                </p>
              )}
            </div>

            <div className="flex flex-col justify-end">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl sm:rounded-lg text-blue-800 text-xs flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 flex-shrink-0 text-blue-600" />
                <span>
                  Estás operando bajo el usuario logístico:{" "}
                  <strong className="font-bold block sm:inline">
                    {user?.nombre_completo}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* LISTADO DE PEDIDOS PENDIENTES */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                2. Seleccionar Pedidos Pendientes de Entrega
              </label>
              <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full w-fit">
                {selectedPedidos.length} pedido(s) seleccionado(s)
              </span>
            </div>

            {formErrors.pedidos && (
              <p className="text-xs font-semibold text-red-600 p-2.5 bg-red-50 rounded-lg border border-red-200">
                {formErrors.pedidos}
              </p>
            )}

            {pedidosPendientes.length === 0 ? (
              <div className="p-6 sm:p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs sm:text-sm font-medium">
                No hay pedidos en estado "Pendiente" en este momento. Crea uno
                nuevo desde el módulo de Toma de Pedidos.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {pedidosPendientes.map((ped) => {
                  const isSelected = selectedPedidos.includes(ped.id);
                  return (
                    <div
                      key={ped.id}
                      onClick={() => {
                        handleSelectPedido(ped.id);
                        setFormErrors((prev) => ({ ...prev, pedidos: "" }));
                      }}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between active:scale-[0.98] select-none min-h-[120px] ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-black text-sm text-slate-900">
                            {ped.id}
                          </span>
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-colors ${
                              isSelected
                                ? "bg-primary text-white shadow-sm"
                                : "bg-slate-100 text-slate-400 border border-slate-300"
                            }`}
                          >
                            {isSelected && "✓"}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm sm:text-base leading-snug">
                          {ped.cliente_nombre}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>Fecha toma: {ped.fecha}</span>
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {ped.items.length} ítem(s)
                        </span>
                        <span className="text-slate-900 font-black text-sm sm:text-base">
                          {formatCurrency(ped.total)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={pedidosPendientes.length === 0}
              className="w-full sm:w-auto ml-auto px-6 py-3.5 sm:py-3 bg-primary hover:bg-primary-hover active:scale-95 disabled:opacity-50 text-white font-bold text-sm sm:text-base rounded-xl sm:rounded-lg shadow-md transition-all flex items-center justify-center gap-2 min-h-[48px]"
            >
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>Confirmar y Emitir Orden de Ruta</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
