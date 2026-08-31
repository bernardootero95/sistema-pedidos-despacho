import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { dispatchService } from "../services/dispatchService";
import { vehicleService } from "../../vehicles/services/vehicleService";
import { orderService } from "../../orders/services/orderService";
import {
  validateDispatchField,
  validateDispatchForm,
  validatePedidosSeleccionados,
} from "../utils/dispatchValidations";
import { DispatchHeaderForm } from "../components/DispatchHeaderForm";
import { PedidosAssignmentPanel } from "../components/PedidosAssignmentPanel";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";

export const DispatchCreatePage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    vehiculo_id: "",
    repartidor_id: "",
    fecha_despacho: new Date().toISOString().split("T")[0],
    notas: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const [vehiculos, setVehiculos] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [pedidosPendientes, setPedidosPendientes] = useState([]);
  const [pedidosSeleccionadosIds, setPedidosSeleccionadosIds] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [pedidosError, setPedidosError] = useState("");

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setLoadingData(true);
        const [vehiculosData, repartidoresData, pedidosData] =
          await Promise.all([
            vehicleService.getVehiculosDisponibles(),
            vehicleService.getRepartidores(),
            orderService.getPedidosPendientes(),
          ]);
        setVehiculos(vehiculosData);
        setRepartidores(repartidoresData);
        setPedidosPendientes(pedidosData);
      } catch (err) {
        setServerError(
          "Error al cargar los catálogos iniciales: " + err.message,
        );
      } finally {
        setLoadingData(false);
      }
    };
    cargarDatos();
  }, []);

  // Deriva disponibles/seleccionados desde una única fuente de verdad,
  // evitando bugs de sincronización entre dos arrays independientes.
  const pedidosSeleccionados = useMemo(
    () =>
      pedidosPendientes.filter((p) => pedidosSeleccionadosIds.includes(p.id)),
    [pedidosPendientes, pedidosSeleccionadosIds],
  );

  const pedidosDisponibles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return pedidosPendientes.filter((p) => {
      if (pedidosSeleccionadosIds.includes(p.id)) return false;
      if (!term) return true;
      const nombreCliente = getNombreCliente(p.clientes).toLowerCase();
      return (
        nombreCliente.includes(term) ||
        p.numero_pedido?.toString().toLowerCase().includes(term)
      );
    });
  }, [pedidosPendientes, pedidosSeleccionadosIds, searchTerm]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const next = { ...prev, [name]: value };

      // Autocompletar el conductor habitual al elegir vehículo
      if (name === "vehiculo_id") {
        const vehiculo = vehiculos.find((v) => v.id === value);
        next.repartidor_id = vehiculo?.conductor_id || "";
      }

      return next;
    });

    if (touched[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateDispatchField(name, value),
      }));
    }
    if (serverError) setServerError("");
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateDispatchField(name, value),
    }));
  };

  const handleAgregarPedido = (pedido) => {
    setPedidosSeleccionadosIds((prev) => [...prev, pedido.id]);
    setPedidosError("");
  };

  const handleQuitarPedido = (pedido) => {
    setPedidosSeleccionadosIds((prev) => prev.filter((id) => id !== pedido.id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const headerErrors = validateDispatchForm(formData);
    const pedidosValidationError = validatePedidosSeleccionados(
      pedidosSeleccionadosIds,
    );

    setTouched({
      vehiculo_id: true,
      repartidor_id: true,
      fecha_despacho: true,
    });
    setErrors(headerErrors);
    setPedidosError(pedidosValidationError);

    if (Object.keys(headerErrors).length > 0 || pedidosValidationError) return;

    setIsSubmitting(true);
    try {
      await dispatchService.crearDespachoTransaccional(
        formData,
        pedidosSeleccionadosIds,
      );
      navigate("/despachos");
    } catch (err) {
      setServerError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount || 0);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 h-full bg-slate-50">
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
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
              Nueva Orden de Despacho
            </h1>
            <p className="text-sm text-slate-500">
              Configura la hoja de ruta y asigna los pedidos
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting || loadingData}
          className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {isSubmitting ? "Guardando..." : "Crear Despacho"}
        </button>
      </div>

      {serverError && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">{serverError}</p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <DispatchHeaderForm
          formData={formData}
          errors={errors}
          touched={touched}
          onChange={handleChange}
          onBlur={handleBlur}
          vehiculos={vehiculos}
          repartidores={repartidores}
        />

        <PedidosAssignmentPanel
          pedidosDisponibles={pedidosDisponibles}
          pedidosSeleccionados={pedidosSeleccionados}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAgregar={handleAgregarPedido}
          onQuitar={handleQuitarPedido}
          formatCurrency={formatCurrency}
          loading={loadingData}
          error={pedidosError}
        />
      </div>

      {/* Botón flotante en móvil */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || loadingData}
        className="sm:hidden fixed bottom-4 left-4 right-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3.5 rounded-xl font-semibold shadow-lg transition-colors disabled:opacity-50 z-20"
      >
        <Save className="w-5 h-5" />
        {isSubmitting ? "Guardando..." : "Crear Despacho"}
      </button>
    </div>
  );
};
