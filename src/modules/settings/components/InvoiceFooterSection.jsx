import { useState, useEffect, useCallback } from "react";
import { invoiceFooterService } from "../services/invoiceFooterService";
import { InvoiceFooterForm } from "./InvoiceFooterForm";
import { useToast } from "../../../context/useToast";
import {
  MessageSquareText,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit,
  Trash2,
} from "lucide-react";

/**
 * Mensajes que se imprimen al pie de pedidos y facturas (promociones,
 * avisos). Solo se imprimen los activos, en el orden en que se crearon.
 */
export const InvoiceFooterSection = () => {
  const { showError, showSuccess } = useToast();
  const [pies, setPies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pieToEdit, setPieToEdit] = useState(null);

  const cargarPies = useCallback(() => {
    invoiceFooterService
      .getPies()
      .then((data) => {
        setPies(data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(cargarPies, [cargarPies]);

  const handleOpenForm = (pie = null) => {
    setPieToEdit(pie);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    const eraEdicion = !!pieToEdit;
    setIsFormOpen(false);
    setPieToEdit(null);
    showSuccess(
      eraEdicion ? "Pie de factura actualizado." : "Pie de factura creado.",
    );
    cargarPies();
  };

  const handleToggleEstado = async (id, estadoActual) => {
    try {
      setPies((prev) =>
        prev.map((p) => (p.id === id ? { ...p, estado: !estadoActual } : p)),
      );
      await invoiceFooterService.toggleEstado(id, !estadoActual);
    } catch (err) {
      showError(err.message);
      cargarPies();
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este pie de factura?"))
      return;
    try {
      setPies((prev) => prev.filter((p) => p.id !== id));
      await invoiceFooterService.eliminarPie(id);
    } catch (err) {
      showError(err.message);
      cargarPies();
    }
  };

  return (
    <section className="space-y-4">
      {isFormOpen && (
        <InvoiceFooterForm
          pieToEdit={pieToEdit}
          onSuccess={handleFormSuccess}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <MessageSquareText className="w-5 h-5 text-primary shrink-0" />
            Pie de factura
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Mensajes que se imprimen al final de pedidos y facturas, como
            promociones o avisos. Solo salen los activos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenForm()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-bold rounded-xl sm:rounded-lg shadow-sm transition-all"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>Nuevo Mensaje</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 flex justify-center items-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin mr-2" />
            Cargando pies de factura...
          </div>
        ) : pies.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            Aún no hay mensajes. Los comprobantes se imprimen sin pie
            personalizado.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {pies.map((pie) => (
              <li
                key={pie.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
              >
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold whitespace-pre-line break-words ${pie.estado ? "text-slate-900" : "text-slate-400"}`}
                  >
                    {pie.mensaje}
                  </p>
                  <span
                    className={`mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 tracking-wider ${
                      pie.estado
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {pie.estado ? (
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 shrink-0" />
                    )}
                    {pie.estado ? "ACTIVO" : "INACTIVO"}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleEstado(pie.id, pie.estado)}
                    title={pie.estado ? "Desactivar" : "Activar"}
                    className={`p-2 rounded-lg transition-colors ${
                      pie.estado
                        ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                        : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                    }`}
                  >
                    {pie.estado ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenForm(pie)}
                    title="Editar"
                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEliminar(pie.id)}
                    title="Eliminar"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
