import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { purchaseService } from "../services/purchaseService";
import { PurchaseAnularControl } from "../components/PurchaseAnularControl";
import {
  ArrowLeft,
  Truck,
  User,
  Calendar,
  Package,
  Loader2,
  AlertCircle,
  StickyNote,
} from "lucide-react";

export const PurchaseDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [compra, setCompra] = useState(null);
  const [detalles, setDetalles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [compraData, detallesData] = await Promise.all([
        purchaseService.getCompraCompleta(id),
        purchaseService.obtenerDetallesCompra(id),
      ]);
      setCompra(compraData);
      setDetalles(detallesData);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la información completa de la compra.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) queueMicrotask(cargarDatos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // fecha_compra puede ser una fecha sin hora (compra cargada con fecha
  // pasada), a diferencia de `creado` que siempre lleva el instante exacto
  // en que se registró — formatos distintos para no mostrar un "00:00"
  // engañoso en la fecha de la compra.
  const formatFechaCompra = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  const handleCompraAnulada = () => {
    cargarDatos();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Cargando detalle de la compra...</p>
      </div>
    );
  }

  if (error || !compra) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 border border-red-200">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <p className="text-sm font-medium">
            {error || "Compra no encontrada."}
          </p>
        </div>
        <button
          onClick={() => navigate("/compras")}
          className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a compras
        </button>
      </div>
    );
  }

  const compraAnulada = compra.estado === "anulada";

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 flex flex-col gap-6 pb-12">
      {/* BARRA SUPERIOR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Compra #{compra.numero_compra}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider ${
                  compraAnulada
                    ? "bg-red-100 text-red-800 border-red-200"
                    : "bg-emerald-100 text-emerald-800 border-emerald-200"
                }`}
              >
                {compra.estado}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <Calendar className="h-3.5 w-3.5" /> Compra del{" "}
              {formatFechaCompra(compra.fecha_compra)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Registrada el {formatDate(compra.creado)}
            </p>
          </div>
        </div>

        <PurchaseAnularControl
          compraId={compra.id}
          estado={compra.estado}
          onAnulada={handleCompraAnulada}
        />
      </div>

      {/* GRID DE INFORMACIÓN GENERAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-blue-600" /> Proveedor
          </h2>
          <div>
            <p className="text-base font-bold text-slate-900">
              {compra.proveedor?.nombre_comercial || "N/A"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {compra.proveedor?.numero_identificacion}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="h-4 w-4 text-emerald-600" /> Registrada por
          </h2>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {compra.usuario?.nombre_completo || "N/A"}
            </p>
          </div>
          {compra.notas && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                <StickyNote className="h-3.5 w-3.5" /> Notas:
              </p>
              <p className="text-xs text-slate-700 italic mt-0.5">
                {compra.notas}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* TARJETA LÍNEAS DE COMPRA */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
            <Package className="h-5 w-5 text-blue-600" />
            Productos ({detalles.length})
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {detalles.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Esta compra no tiene productos.
            </div>
          ) : (
            detalles.map((item) => (
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
                    {formatCurrency(item.costo_unitario)}
                  </p>
                </div>
                <p className="text-base font-bold text-slate-900">
                  {formatCurrency(item.subtotal_linea)}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-600">Total</span>
          <span className="text-lg font-bold text-slate-900">
            {formatCurrency(compra.total)}
          </span>
        </div>
      </div>
    </div>
  );
};
