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

  // Estado local para despachos y pedidos pendientes
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

    // Actualizar estado local y sincronizar DEMO_DATA para simulación
    setDespachos([newDispatch, ...despachos]);
    DEMO_DATA.despachos.unshift(newDispatch);

    // Marcar pedidos seleccionados como "despachado" en DEMO_DATA
    DEMO_DATA.pedidos.forEach((p) => {
      if (selectedPedidos.includes(p.id)) {
        p.estado = "despachado";
      }
    });

    // Actualizar la lista local de pendientes
    setPedidosPendientes(
      pedidosPendientes.filter((p) => !selectedPedidos.includes(p.id)),
    );

    // Resetear y volver
    setVehiculoPlaca("");
    setSelectedPedidos([]);
    setFormErrors({});
    setActiveTab("list");
    alert(
      `¡Orden de Despacho ${newDispatch.id} generada y asignada al vehículo ${vehiculo.placa}!`,
    );
  };

  return (
    <div className="space-y-6">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            Gestión y Órdenes de Despacho
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Agrupación logistica de pedidos, asignación de flota de reparto y
            control de rutas.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
              activeTab === "list"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Rutas Activas ({despachos.length})
          </button>
          <button
            onClick={() => {
              // Refrescar pendientes en caso de que hayan creado un pedido en la pestaña anterior
              setPedidosPendientes(
                DEMO_DATA.pedidos.filter((p) => p.estado === "pendiente"),
              );
              setActiveTab("new");
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-all ${
              activeTab === "new"
                ? "bg-primary text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Plus className="w-4 h-4" /> Armar Nuevo Despacho
          </button>
        </div>
      </div>

      {/* VISTA 1: RUTAS Y DESPACHOS ACTIVOS */}
      {activeTab === "list" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {despachos.map((dsp) => (
            <div
              key={dsp.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between"
            >
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/20 text-primary-light rounded-lg font-bold">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">
                      Orden de Despacho
                    </span>
                    <h3 className="text-lg font-black font-mono text-white">
                      {dsp.id}
                    </h3>
                  </div>
                </div>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> En Ruta
                </span>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Vehículo Asignado
                    </span>
                    <p className="font-bold text-slate-900 font-mono text-sm">
                      {dsp.vehiculo_placa}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Conductor
                    </span>
                    <p className="font-semibold text-slate-700 text-sm">
                      {dsp.conductor_nombre}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" /> Pedidos en esta ruta (
                    {dsp.pedidos_ids.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {dsp.pedidos_ids.map((id) => (
                      <span
                        key={id}
                        className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-800 font-mono text-xs font-bold rounded"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 px-5">
                <span>
                  Despachado por: <strong>{dsp.despachador_nombre}</strong>
                </span>
                <span>Fecha: {dsp.fecha}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VISTA 2: ARMAR NUEVO DESPACHO (Validación en tiempo real) */}
      {activeTab === "new" && (
        <form
          onSubmit={handleSubmitDispatch}
          className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6"
          noValidate
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-200">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                1. Asignar Vehículo / Conductor
              </label>
              <select
                value={vehiculoPlaca}
                onChange={(e) => {
                  setVehiculoPlaca(e.target.value);
                  setFormErrors((prev) => ({ ...prev, vehiculo: "" }));
                }}
                className={`w-full p-3 bg-slate-50 border rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 ${
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
                <p className="mt-1 text-xs font-semibold text-red-600">
                  {formErrors.vehiculo}
                </p>
              )}
            </div>

            <div className="flex flex-col justify-end">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 flex-shrink-0 text-blue-600" />
                <span>
                  Estás armando esta orden bajo el usuario logístico:{" "}
                  <strong className="font-bold">{user?.nombre_completo}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* LISTADO DE PEDIDOS PENDIENTES A SELECCIONAR */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                2. Seleccionar Pedidos Pendientes de Entrega
              </label>
              <span className="text-xs font-semibold text-slate-500">
                {selectedPedidos.length} pedido(s) seleccionado(s)
              </span>
            </div>

            {formErrors.pedidos && (
              <p className="text-xs font-semibold text-red-600 p-2 bg-red-50 rounded border border-red-200">
                {formErrors.pedidos}
              </p>
            )}

            {pedidosPendientes.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm font-medium">
                No hay pedidos en estado "Pendiente" en este momento. Crea uno
                nuevo desde el módulo de Toma de Pedidos.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pedidosPendientes.map((ped) => {
                  const isSelected = selectedPedidos.includes(ped.id);
                  return (
                    <div
                      key={ped.id}
                      onClick={() => {
                        handleSelectPedido(ped.id);
                        setFormErrors((prev) => ({ ...prev, pedidos: "" }));
                      }}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
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
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                              isSelected
                                ? "bg-primary text-white"
                                : "bg-slate-100 text-slate-400 border border-slate-300"
                            }`}
                          >
                            {isSelected && "✓"}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm leading-snug">
                          {ped.cliente_nombre}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" /> Fecha
                          toma: {ped.fecha}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-500">
                          {ped.items.length} ítem(s)
                        </span>
                        <span className="text-slate-900 font-black">
                          {formatCurrency(ped.total)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={pedidosPendientes.length === 0}
              className="px-6 py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold text-sm rounded-lg shadow-md transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" /> Confirmar y Emitir Orden de
              Ruta
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
