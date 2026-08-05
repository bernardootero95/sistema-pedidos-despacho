import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { orderService } from "../services/orderService";
import { imprimirPedidoPdf } from "../utils/printUtils";
import {
  ArrowLeft,
  Printer,
  Package,
  User,
  MapPin,
  Calendar,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

export const OrderDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const fetchPedido = async () => {
      try {
        setLoading(true);
        const data = await orderService.getPedidoCompleto(id);
        setPedido(data);
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar la información completa del pedido.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchPedido();
    }
  }, [id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handlePrint = async () => {
    if (!pedido) return;
    setIsPrinting(true);
    try {
      await imprimirPedidoPdf(pedido);
    } finally {
      setIsPrinting(false);
    }
  };

  const calcularDesglose = () => {
    if (!pedido || !pedido.detalles)
      return { subtotal: 0, iva19: 0, iva5: 0, inc8: 0 };
    let subtotalGeneral = 0;
    let acumIva19 = 0;
    let acumIva5 = 0;
    let acumInc8 = 0;

    pedido.detalles.forEach((item) => {
      const subtotalLinea = Number(item.subtotal_linea) || 0;
      const porcIva = Math.round(Number(item.iva_porcentaje) || 0);
      const porcInc = Math.round(Number(item.inc_porcentaje) || 0);

      const factor = 1 + (porcIva + porcInc) / 100;
      const baseLinea = subtotalLinea / factor;

      subtotalGeneral += baseLinea;

      if (porcIva === 19) acumIva19 += baseLinea * (19 / 100);
      else if (porcIva === 5) acumIva5 += baseLinea * (5 / 100);
      if (porcInc === 8) acumInc8 += baseLinea * (8 / 100);
    });

    return {
      subtotal: subtotalGeneral,
      iva19: acumIva19,
      iva5: acumIva5,
      inc8: acumInc8,
    };
  };

  const { subtotal, iva19, iva5, inc8 } = calcularDesglose();

  const getStatusBadge = (estado) => {
    const styles = {
      pendiente: "bg-amber-100 text-amber-800 border-amber-200",
      en_ruta: "bg-blue-100 text-blue-800 border-blue-200",
      entregado: "bg-emerald-100 text-emerald-800 border-emerald-200",
      anulado: "bg-red-100 text-red-800 border-red-200",
    };
    const currentStyle =
      styles[estado?.toLowerCase()] ||
      "bg-slate-100 text-slate-800 border-slate-200";

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider ${currentStyle}`}
      >
        {estado?.replace("_", " ")}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Cargando detalles de la orden...</p>
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 border border-red-200">
          <AlertCircle className="h-6 w-6 flex-shrink-0" />
          <p className="text-sm font-medium">
            {error || "Pedido no encontrado."}
          </p>
        </div>
        <button
          onClick={() => navigate("/pedidos")}
          className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a pedidos
        </button>
      </div>
    );
  }

  const cliente = pedido.clientes;
  const clienteNombre =
    cliente?.razon_social ||
    `${cliente?.primer_nombre || ""} ${cliente?.primer_apellido || ""}`;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 flex flex-col gap-6 pb-12">
      {/* BARRA SUPERIOR DE NAVEGACIÓN Y ACCIONES */}
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
                Pedido #{pedido.numero_pedido}
              </h1>
              {getStatusBadge(pedido.estado)}
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <Calendar className="h-3.5 w-3.5" />{" "}
              {formatDate(pedido.fecha_pedido)}
            </p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          disabled={isPrinting}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
          {isPrinting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          Imprimir Tiquete 80mm
        </button>
      </div>

      {/* GRID DE INFORMACIÓN GENERAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TARJETA CLIENTE */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="h-4 w-4 text-blue-600" /> Información del Cliente
          </h2>
          <div>
            <p className="text-base font-bold text-slate-900">
              {clienteNombre}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {cliente?.tipo_identificacion || "NIT/CC"}:{" "}
              <span className="font-semibold text-slate-700">
                {cliente?.numero_identificacion}
              </span>
            </p>
          </div>
          <div className="flex items-start gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
            <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>{cliente?.direccion || "Dirección no registrada"}</span>
          </div>
        </div>

        {/* TARJETA VENDEDOR Y NOTAS */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Control y
            Logística
          </h2>
          <div>
            <p className="text-xs text-slate-500">Vendedor Asignado:</p>
            <p className="text-sm font-semibold text-slate-800">
              {pedido.vendedor?.nombre_completo || "No asignado"}
            </p>
          </div>
          {pedido.notas && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500 font-semibold">
                Notas u Observaciones:
              </p>
              <p className="text-xs text-slate-700 italic mt-0.5">
                {pedido.notas}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* TARJETA DETALLE DE PRODUCTOS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
            <Package className="h-5 w-5 text-blue-600" />
            Productos Solicitados ({pedido.detalles?.length || 0})
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {pedido.detalles?.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-xl text-xs sm:text-sm flex-shrink-0">
                  {item.cantidad}x
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                    {item.producto?.nombre}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Código:{" "}
                    <span className="font-mono">
                      {item.producto?.codigo || "N/D"}
                    </span>{" "}
                    • V. Unit: {formatCurrency(item.precio_unitario)}
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right pl-11 sm:pl-0">
                <p className="text-xs text-slate-400 sm:hidden">Total Línea:</p>
                <p className="text-base font-bold text-slate-900">
                  {formatCurrency(item.subtotal_linea)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* RESUMEN FINANCIERO FISCAL */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col gap-2 text-xs sm:text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal (Base Gravable):</span>
            <span className="font-medium text-slate-800">
              {formatCurrency(subtotal)}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>IVA 19%:</span>
            <span className="font-medium text-slate-800">
              {formatCurrency(iva19)}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>IVA 5%:</span>
            <span className="font-medium text-slate-800">
              {formatCurrency(iva5)}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>INC 8%:</span>
            <span className="font-medium text-slate-800">
              {formatCurrency(inc8)}
            </span>
          </div>
          <div className="flex justify-between font-bold text-base sm:text-lg text-slate-900 pt-3 border-t border-slate-300 mt-1">
            <span>TOTAL A PAGAR:</span>
            <span className="text-blue-600">
              {formatCurrency(pedido.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
