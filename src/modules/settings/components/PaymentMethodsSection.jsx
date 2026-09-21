import { useState, useEffect, useCallback } from "react";
import { paymentMethodService } from "../services/paymentMethodService";
import { PaymentMethodForm } from "./PaymentMethodForm";
import { CODIGOS_DIAN_MEDIO_PAGO } from "../utils/dianPaymentCodes";
import { useToast } from "../../../context/useToast";
import { useSettings } from "../../../context/useSettings";
import {
  CreditCard,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit,
  Trash2,
} from "lucide-react";

const etiquetaDian = (codigo) =>
  CODIGOS_DIAN_MEDIO_PAGO.find((c) => c.codigo === codigo)?.etiqueta ||
  codigo;

/**
 * Catálogo de métodos de pago (crear, renombrar, activar/desactivar,
 * eliminar). Efectivo es el método por defecto y solo se puede renombrar.
 */
export const PaymentMethodsSection = () => {
  const { showError, showSuccess } = useToast();
  const { recargar: recargarConfiguracion } = useSettings();
  const [metodos, setMetodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [metodoToEdit, setMetodoToEdit] = useState(null);

  const cargarMetodos = useCallback(() => {
    paymentMethodService
      .getMetodosPago()
      .then((data) => {
        setMetodos(data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(cargarMetodos, [cargarMetodos]);

  // Los diálogos de cobro leen el catálogo del contexto: se refresca tras
  // cada cambio para que no ofrezcan métodos ya desactivados o eliminados.
  const sincronizar = () => {
    cargarMetodos();
    recargarConfiguracion();
  };

  const handleOpenForm = (metodo = null) => {
    setMetodoToEdit(metodo);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    const eraEdicion = !!metodoToEdit;
    setIsFormOpen(false);
    setMetodoToEdit(null);
    showSuccess(
      eraEdicion ? "Método de pago actualizado." : "Método de pago creado.",
    );
    sincronizar();
  };

  const handleToggleEstado = async (id, estadoActual) => {
    try {
      setMetodos((prev) =>
        prev.map((m) => (m.id === id ? { ...m, estado: !estadoActual } : m)),
      );
      await paymentMethodService.toggleEstado(id, !estadoActual);
      recargarConfiguracion();
    } catch (err) {
      showError(err.message);
      cargarMetodos();
    }
  };

  const handleEliminar = async (id, nombre) => {
    if (
      !window.confirm(
        `¿Seguro que deseas eliminar el método de pago "${nombre}"? Los pagos ya registrados conservan su nombre.`,
      )
    )
      return;
    try {
      setMetodos((prev) => prev.filter((m) => m.id !== id));
      await paymentMethodService.eliminarMetodoPago(id);
      recargarConfiguracion();
    } catch (err) {
      showError(err.message);
      cargarMetodos();
    }
  };

  return (
    <section className="space-y-4">
      {isFormOpen && (
        <PaymentMethodForm
          metodoToEdit={metodoToEdit}
          onSuccess={handleFormSuccess}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary shrink-0" />
            Métodos de pago
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Los que se ofrecen al registrar un pago. Efectivo es el método por
            defecto y no se puede desactivar ni eliminar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenForm()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-bold rounded-xl sm:rounded-lg shadow-sm transition-all"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>Nuevo Método</span>
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
            Cargando métodos de pago...
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {metodos.map((metodo) => (
              <li
                key={metodo.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900 truncate">
                      {metodo.nombre}
                    </p>
                    {metodo.es_efectivo && (
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                        Por defecto
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 tracking-wider ${
                        metodo.estado
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {metodo.estado ? (
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 shrink-0" />
                      )}
                      {metodo.estado ? "ACTIVO" : "INACTIVO"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    DIAN: {etiquetaDian(metodo.codigo_dian)}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-1 shrink-0">
                  {!metodo.es_efectivo && (
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleEstado(metodo.id, metodo.estado)
                      }
                      title={metodo.estado ? "Desactivar" : "Activar"}
                      className={`p-2 rounded-lg transition-colors ${
                        metodo.estado
                          ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                          : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                      }`}
                    >
                      {metodo.estado ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenForm(metodo)}
                    title="Editar"
                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {!metodo.es_efectivo && (
                    <button
                      type="button"
                      onClick={() => handleEliminar(metodo.id, metodo.nombre)}
                      title="Eliminar"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
