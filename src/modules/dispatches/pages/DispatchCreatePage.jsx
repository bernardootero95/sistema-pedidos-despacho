import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Truck,
  User,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  MapPin,
} from "lucide-react";
// Importaremos los servicios cuando estén construidos, por ahora dejamos la estructura preparada
// import { dispatchService } from "../services/dispatchService";
// import { vehicleService } from "../../vehicles/services/vehicleService";
// import { userService } from "../../users/services/userService";
// import { orderService } from "../../orders/services/orderService";

export const DispatchCreatePage = () => {
  const navigate = useNavigate();

  // Estados para la Cabecera
  const [formData, setFormData] = useState({
    vehiculo_id: "",
    conductor_id: "",
    fecha_despacho: new Date().toISOString().split("T")[0], // Fecha actual por defecto
    observaciones: "",
  });

  // Estados para los datos de selección (Listas desplegables)
  const [vehiculos, setVehiculos] = useState([]);
  const [conductores, setConductores] = useState([]);

  // Estados para el armado de la ruta (Detalle)
  const [pedidosDisponibles, setPedidosDisponibles] = useState([]);
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Carga inicial de datos (Mockeado temporalmente para maquetación)
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Aquí irían las llamadas reales: await vehicleService.getActivos(), etc.
        setVehiculos([{ id: "1", placa: "ABC-123", marca: "Hino" }]);
        setConductores([{ id: "1", nombre_completo: "Carlos Pérez" }]);
        setPedidosDisponibles([
          {
            id: "PED-1001",
            cliente: "Supermercado Central",
            municipio: "Ciénaga",
            total: 150000,
            peso: "150kg",
          },
          {
            id: "PED-1002",
            cliente: "Tienda La Esquina",
            municipio: "Santa Marta",
            total: 45000,
            peso: "20kg",
          },
        ]);
      } catch (err) {
        setError("Error al cargar los catálogos iniciales.");
      }
    };
    cargarDatos();
  }, []);

  // Validaciones inmediatas
  const handleAgregarPedido = (pedido) => {
    // Evitar duplicados
    if (pedidosSeleccionados.find((p) => p.id === pedido.id)) return;

    setPedidosSeleccionados([...pedidosSeleccionados, pedido]);
    setPedidosDisponibles(pedidosDisponibles.filter((p) => p.id !== pedido.id));
  };

  const handleQuitarPedido = (pedido) => {
    setPedidosSeleccionados(
      pedidosSeleccionados.filter((p) => p.id !== pedido.id),
    );
    setPedidosDisponibles([...pedidosDisponibles, pedido]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(""); // Limpiar error al modificar
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones estrictas antes de enviar
    if (!formData.vehiculo_id)
      return setError("Debes seleccionar un vehículo asignado.");
    if (!formData.conductor_id)
      return setError("Debes asignar un conductor para la ruta.");
    if (pedidosSeleccionados.length === 0)
      return setError("No puedes crear un despacho sin pedidos asignados.");

    setIsSubmitting(true);
    try {
      // Aquí irá la llamada al dispatchService para guardar Cabecera y Detalle en transacción
      console.log("Guardando despacho...", {
        cabecera: formData,
        detalle: pedidosSeleccionados,
      });

      // Simulación de guardado exitoso
      setTimeout(() => {
        navigate("/despachos");
      }, 1000);
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  // Filtrado en tiempo real de pedidos disponibles
  const pedidosFiltrados = pedidosDisponibles.filter(
    (p) =>
      p.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6 p-6 h-full bg-slate-50">
      {/* HEADER DE LA PÁGINA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/despachos")}
            className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Nueva Orden de Despacho
            </h1>
            <p className="text-sm text-slate-500">
              Configura la hoja de ruta y asigna los pedidos
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {isSubmitting ? "Guardando..." : "Crear Despacho"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA: CABECERA DEL DESPACHO (Formulario) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-500" />
              Datos Logísticos
            </h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fecha de Despacho
                </label>
                <input
                  type="date"
                  name="fecha_despacho"
                  value={formData.fecha_despacho}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Vehículo Asignado
                </label>
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <select
                    name="vehiculo_id"
                    value={formData.vehiculo_id}
                    onChange={handleChange}
                    className="w-full pl-10 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                  >
                    <option value="">Seleccione un vehículo...</option>
                    {vehiculos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.placa} - {v.marca}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Conductor / Repartidor
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <select
                    name="conductor_id"
                    value={formData.conductor_id}
                    onChange={handleChange}
                    className="w-full pl-10 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                  >
                    <option value="">Seleccione el conductor...</option>
                    {conductores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre_completo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observaciones de Ruta
                </label>
                <textarea
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleChange}
                  placeholder="Instrucciones para el viaje..."
                  rows="3"
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: ARMADO DE RUTA (Selección de Pedidos) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-500" />
              Armado de Ruta ({pedidosSeleccionados.length} pedidos)
            </h2>

            {/* Buscador de pedidos */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar pedido por cliente o código para agregar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 grow overflow-hidden">
              {/* Lista de Disponibles */}
              <div className="border border-slate-200 rounded-lg flex flex-col h-100">
                <div className="bg-slate-50 p-3 font-medium text-slate-700 border-b border-slate-200">
                  Pendientes por Despachar
                </div>
                <div className="overflow-y-auto p-2 flex flex-col gap-2 grow">
                  {pedidosFiltrados.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center mt-4">
                      No hay pedidos disponibles.
                    </p>
                  ) : (
                    pedidosFiltrados.map((pedido) => (
                      <div
                        key={pedido.id}
                        className="p-3 border border-slate-200 rounded-lg flex justify-between items-center hover:border-blue-300 transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-sm text-slate-800">
                            {pedido.id}
                          </p>
                          <p className="text-xs text-slate-600 truncate w-32">
                            {pedido.cliente}
                          </p>
                          <p className="text-xs text-slate-400">
                            {pedido.municipio}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAgregarPedido(pedido)}
                          className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition-colors"
                          title="Agregar a la ruta"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Lista de Seleccionados */}
              <div className="border border-blue-200 rounded-lg flex flex-col h-100">
                <div className="bg-blue-50 p-3 font-medium text-blue-800 border-b border-blue-200 flex justify-between">
                  <span>En este Camión</span>
                  <span className="bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full">
                    {pedidosSeleccionados.length}
                  </span>
                </div>
                <div className="overflow-y-auto p-2 flex flex-col gap-2 grow bg-slate-50">
                  {pedidosSeleccionados.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center mt-4 flex flex-col items-center gap-2">
                      <Truck className="w-8 h-8 text-slate-300" />
                      El camión está vacío. <br /> Agrega pedidos desde la
                      izquierda.
                    </p>
                  ) : (
                    pedidosSeleccionados.map((pedido, index) => (
                      <div
                        key={pedido.id}
                        className="p-3 bg-white border border-slate-200 rounded-lg flex justify-between items-center shadow-sm"
                      >
                        <div className="flex gap-3 items-center">
                          <span className="text-slate-400 font-medium text-xs">
                            {index + 1}.
                          </span>
                          <div>
                            <p className="font-semibold text-sm text-slate-800">
                              {pedido.id}
                            </p>
                            <p className="text-xs text-slate-600 truncate w-32">
                              {pedido.cliente}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleQuitarPedido(pedido)}
                          className="text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Quitar de la ruta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
