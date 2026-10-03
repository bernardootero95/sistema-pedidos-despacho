import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Calendar,
  Package,
  Loader2,
  AlertCircle,
  StickyNote,
  Printer,
  ShoppingCart,
} from "lucide-react";
import { quoteService } from "../services/quoteService";
import { QuoteStatusBadge } from "../components/QuoteStatusBadge";
import { QuoteAnularControl } from "../components/QuoteAnularControl";
import { QuoteConvertControl } from "../components/QuoteConvertControl";
import { imprimirCotizacionPdf } from "../utils/quotePrintUtils";
import { puedeAnularse, puedeConvertirse } from "../utils/quoteStatus";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount || 0);

// timeZone UTC: fecha_vencimiento es un DATE (medianoche UTC al parsear).
const formatFecha = (valor, timeZone = "UTC") =>
  valor
    ? new Date(valor).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone,
      })
    : "N/A";

export const QuoteDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cotizacion, setCotizacion] = useState(null);
  const [detalles, setDetalles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imprimiendo, setImprimiendo] = useState(false);
  const [aviso, setAviso] = useState("");

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const [cabecera, lineas] = await Promise.all([
        quoteService.getCotizacionCompleta(id),
        quoteService.obtenerDetallesCotizacion(id),
      ]);
      setCotizacion(cabecera);
      setDetalles(lineas);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la información de la cotización.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(cargarDatos);
  }, [cargarDatos]);

  const handleImprimir = async () => {
    setImprimiendo(true);
    setAviso("");
    try {
      await imprimirCotizacionPdf(cotizacion, detalles);
    } catch (err) {
      setAviso(err.message);
    } finally {
      setImprimiendo(false);
    }
  };

  // Tras una mutación con efectos en el servidor se recarga el recurso en
  // vez de adivinar el resultado en el cliente.
  const handleConvertida = (resultado) => {
    const difiere = resultado.total_pedido !== resultado.total_cotizado;
    setAviso(
      difiere
        ? `Pedido N° ${resultado.numero_pedido} creado con precios vigentes: ${formatCurrency(resultado.total_pedido)} (cotizado: ${formatCurrency(resultado.total_cotizado)}).`
        : `Pedido N° ${resultado.numero_pedido} creado.`,
    );
    cargarDatos();
  };

  if (loading && !cotizacion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Cargando cotización...</p>
      </div>
    );
  }

  if (error || !cotizacion) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 border border-red-200">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <p className="text-sm font-medium">{error || "Cotización no encontrada."}</p>
        </div>
        <button
          onClick={() => navigate("/cotizaciones")}
          className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a cotizaciones
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 flex flex-col gap-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/cotizaciones")}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Cotización #{cotizacion.numero_cotizacion}
              </h1>
              <QuoteStatusBadge cotizacion={cotizacion} />
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <Calendar className="h-3.5 w-3.5" /> Válida hasta el{" "}
              {formatFecha(cotizacion.fecha_vencimiento)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Creada el {formatFecha(cotizacion.fecha_cotizacion, "America/Bogota")}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleImprimir}
            disabled={imprimiendo}
            className="px-4 py-2.5 rounded-xl font-medium text-sm border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {imprimiendo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Imprimir PDF
          </button>
          {puedeConvertirse(cotizacion) && (
            <QuoteConvertControl
              cotizacionId={cotizacion.id}
              onConvertida={handleConvertida}
            />
          )}
          {puedeAnularse(cotizacion) && (
            <QuoteAnularControl
              cotizacionId={cotizacion.id}
              onAnulada={cargarDatos}
            />
          )}
        </div>
      </div>

      {aviso && (
        <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-sm border border-blue-200">
          {aviso}
        </div>
      )}

      {cotizacion.estado === "convertida" && cotizacion.pedido && (
        <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-sm border border-blue-200 flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 shrink-0" />
          Convertida en el{" "}
          <Link
            to={`/orders/${cotizacion.pedido_id}`}
            className="font-bold underline"
          >
            pedido N° {cotizacion.pedido.numero_pedido}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="h-4 w-4 text-blue-600" /> Cliente
          </h2>
          <div>
            <p className="text-base font-bold text-slate-900">
              {getNombreCliente(cotizacion.cliente) || "N/A"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {cotizacion.cliente?.numero_identificacion}
            </p>
            {cotizacion.cliente?.telefono && (
              <p className="text-xs text-slate-500">{cotizacion.cliente.telefono}</p>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="h-4 w-4 text-emerald-600" /> Elaborada por
          </h2>
          <p className="text-sm font-semibold text-slate-800">
            {cotizacion.usuario?.nombre_completo || "N/A"}
          </p>
          {cotizacion.notas && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                <StickyNote className="h-3.5 w-3.5" />
                {cotizacion.estado === "anulada" ? "Motivo de anulación:" : "Notas:"}
              </p>
              <p className="text-xs text-slate-700 italic mt-0.5">{cotizacion.notas}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
            <Package className="h-5 w-5 text-blue-600" />
            Productos ({detalles.length})
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {detalles.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
            >
              <div>
                <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                  {item.producto?.nombre}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {item.producto?.codigo} · {item.cantidad} x{" "}
                  {formatCurrency(item.precio_unitario)}
                </p>
              </div>
              <p className="text-base font-bold text-slate-900">
                {formatCurrency(item.subtotal_linea)}
              </p>
            </div>
          ))}
        </div>

        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-600">Total</span>
          <span className="text-lg font-bold text-slate-900">
            {formatCurrency(cotizacion.total)}
          </span>
        </div>
      </div>
    </div>
  );
};
