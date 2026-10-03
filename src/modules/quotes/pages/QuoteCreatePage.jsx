import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  FileText,
  UserPlus,
  Calendar,
} from "lucide-react";
import { quoteService } from "../services/quoteService";
import { clientService } from "../../clients/services/clientService";
import { productService } from "../../products/services/productService";
import { validateQuoteForm, validateQuoteField } from "../utils/quoteValidations";
import {
  DIAS_VIGENCIA_POR_DEFECTO,
  hoyIso,
  sumarDiasIso,
} from "../utils/quoteStatus";
import { useCarritoPedido } from "../../orders/hooks/useCarritoPedido";
import { ProductSearchBar } from "../../orders/components/ProductSearchBar";
import { CarritoPedido } from "../../orders/components/CarritoPedido";
import { ClientForm } from "../../clients/components/ClientForm";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";
import { useAuth } from "../../../context/useAuth";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount || 0);

// Solo soporte/gerencia acceden a cotizaciones, y ambos pueden aplicar
// precio mayorista (mismos roles que valida resolver_precio_pedido).
const PUEDE_MAYORISTA = true;

export const QuoteCreatePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [clienteId, setClienteId] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState(() =>
    sumarDiasIso(hoyIso(), DIAS_VIGENCIA_POR_DEFECTO),
  );
  const [notas, setNotas] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);

  const {
    carrito,
    errorStock: errorCarrito,
    agregarAlCarrito,
    modificarCantidad,
    actualizarCantidadInput,
    cambiarTipoPrecio,
    eliminarDelCarrito,
    totalPedido: total,
  } = useCarritoPedido(productos, [], { validarStock: false });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientesData, productosData, mayoristas, personalizados] =
          await Promise.all([
            clientService.getClientesActivos(),
            productService.getProductosActivos(),
            productService.getTodosPreciosMayoristas(),
            productService.getTodosPreciosPersonalizados(),
          ]);

        setClientes(clientesData);
        setProductos(
          productosData.map((p) => ({
            ...p,
            tiersMayoristas: mayoristas.filter((t) => t.producto_id === p.id),
            preciosPersonalizados: personalizados.filter(
              (t) => t.producto_id === p.id,
            ),
          })),
        );
      } catch (error) {
        console.error("Error cargando datos base:", error);
        setErrors({ global: "No se pudieron cargar clientes y productos." });
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const validarCampo = (campo, valor) =>
    setErrors((prev) => ({
      ...prev,
      [campo]: validateQuoteField(campo, valor),
    }));

  const handleClienteChange = (value) => {
    setClienteId(value);
    validarCampo("cliente_id", value);
  };

  const handleFechaChange = (value) => {
    setFechaVencimiento(value);
    validarCampo("fecha_vencimiento", value);
  };

  // Refresca el selector tras crear un cliente desde el quick-add y lo
  // deja seleccionado, sin recargar la página.
  const handleClienteCreado = async (clienteNuevo) => {
    setIsClientFormOpen(false);
    try {
      setClientes(await clientService.getClientesActivos());
    } finally {
      if (clienteNuevo?.id) handleClienteChange(clienteNuevo.id);
    }
  };

  const handleAgregar = () => {
    agregarAlCarrito(productoSeleccionado);
    setProductoSeleccionado("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cabecera = {
      cliente_id: clienteId,
      fecha_vencimiento: fechaVencimiento,
      notas,
    };
    const validationErrors = validateQuoteForm(cabecera, carrito);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      const resultado = await quoteService.crearCotizacion(cabecera, carrito);
      navigate(`/cotizaciones/${resultado.id}`);
    } catch (error) {
      console.error(error);
      setErrors({
        global: error.message || "Ocurrió un error al guardar la cotización.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p>Preparando cotización...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-50 pb-24">
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/cotizaciones")}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
            <FileText className="h-5 w-5 text-blue-600" />
            Nueva Cotización
          </h1>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 flex flex-col gap-4 max-w-3xl mx-auto w-full"
      >
        {errors.global && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl flex items-center gap-2 text-sm border border-red-200">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {errors.global}
          </div>
        )}

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Cliente *
              </label>
              <button
                type="button"
                onClick={() => setIsClientFormOpen(true)}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Cliente nuevo
              </button>
            </div>
            <select
              value={clienteId}
              onChange={(e) => handleClienteChange(e.target.value)}
              onBlur={() => validarCampo("cliente_id", clienteId)}
              className={`w-full p-3 border rounded-xl outline-none bg-white text-base transition-all ${errors.cliente_id ? "border-red-500 ring-2 ring-red-100" : "border-slate-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"}`}
            >
              <option value="">-- Elige el cliente --</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero_identificacion} - {getNombreCliente(c)}
                </option>
              ))}
            </select>
            {errors.cliente_id && (
              <p className="text-red-500 text-xs mt-1 font-medium">
                {errors.cliente_id}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Válida hasta *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              <input
                type="date"
                value={fechaVencimiento}
                min={hoyIso()}
                onChange={(e) => handleFechaChange(e.target.value)}
                className={`w-full pl-9 p-3 border rounded-xl outline-none bg-white text-base transition-all ${errors.fecha_vencimiento ? "border-red-500 ring-2 ring-red-100" : "border-slate-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"}`}
              />
            </div>
            {errors.fecha_vencimiento && (
              <p className="text-red-500 text-xs mt-1 font-medium">
                {errors.fecha_vencimiento}
              </p>
            )}
          </div>
        </div>

        <ProductSearchBar
          productos={productos}
          productoSeleccionado={productoSeleccionado}
          onSelectChange={setProductoSeleccionado}
          onAgregar={handleAgregar}
          error={errorCarrito || errors.carrito}
          formatCurrency={formatCurrency}
          mostrarStock={false}
          etiqueta="Agregar Productos a la Cotización"
        />

        <CarritoPedido
          carrito={carrito}
          onModificarCantidad={modificarCantidad}
          onActualizarCantidadInput={actualizarCantidadInput}
          onCambiarTipoPrecio={cambiarTipoPrecio}
          onEliminar={eliminarDelCarrito}
          formatCurrency={formatCurrency}
          puedeMayorista={PUEDE_MAYORISTA}
          rolActual={user?.rol}
          titulo="Productos en la Cotización"
          mostrarStock={false}
        />

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Notas u observaciones
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Condiciones de pago, tiempo de entrega..."
              className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 resize-none h-20 text-sm"
            ></textarea>
          </div>

          <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
            <span className="text-slate-300 text-sm font-medium">
              Total Cotización
            </span>
            <span className="text-2xl font-bold">{formatCurrency(total)}</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70 text-base"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Guardar Cotización
          </button>
        </div>
      </form>

      {isClientFormOpen && (
        <ClientForm
          onSuccess={handleClienteCreado}
          onCancel={() => setIsClientFormOpen(false)}
        />
      )}
    </div>
  );
};
