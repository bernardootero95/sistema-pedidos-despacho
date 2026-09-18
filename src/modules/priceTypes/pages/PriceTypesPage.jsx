import { useState, useEffect } from "react";
import { priceTypeService } from "../services/priceTypeService";
import { PriceTypeForm } from "../components/PriceTypeForm";
import { useToast } from "../../../context/useToast";
import {
  Tag,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit,
  Trash2,
} from "lucide-react";

const capitalizar = (rol) => rol.charAt(0).toUpperCase() + rol.slice(1);

export const PriceTypesPage = () => {
  const { showError, showSuccess } = useToast();
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [tipoToEdit, setTipoToEdit] = useState(null);

  const cargarTipos = () => {
    priceTypeService
      .getTiposPrecio()
      .then((data) => {
        setTipos(data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(cargarTipos, []);

  const handleOpenForm = (tipo = null) => {
    setTipoToEdit(tipo);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    const eraEdicion = !!tipoToEdit;
    setIsFormOpen(false);
    setTipoToEdit(null);
    showSuccess(
      eraEdicion ? "Tipo de precio actualizado." : "Tipo de precio creado.",
    );
    cargarTipos();
  };

  const handleToggleEstado = async (id, estadoActual) => {
    try {
      setTipos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, estado: !estadoActual } : t)),
      );
      await priceTypeService.toggleEstado(id, !estadoActual);
    } catch (err) {
      showError(err.message);
      cargarTipos();
    }
  };

  const handleEliminar = async (id, nombre) => {
    if (
      !window.confirm(
        `¿Seguro que deseas eliminar el tipo de precio "${nombre}"? Los productos dejarán de ofrecerlo.`,
      )
    )
      return;
    try {
      setTipos((prev) => prev.filter((t) => t.id !== id));
      await priceTypeService.eliminarTipoPrecio(id);
    } catch (err) {
      showError(err.message);
      cargarTipos();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 relative">
      {isFormOpen && (
        <PriceTypeForm
          tipoToEdit={tipoToEdit}
          onSuccess={handleFormSuccess}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-primary shrink-0" />
            <span>Tipos de Precio</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Precios diferenciados por producto y qué roles pueden aplicarlos al
            armar un pedido.
          </p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-bold rounded-xl sm:rounded-lg shadow-sm transition-all"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>Nuevo Tipo de Precio</span>
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
            Cargando tipos de precio...
          </div>
        ) : tipos.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Aún no hay tipos de precio. Crea el primero con el botón de arriba.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {tipos.map((tipo) => (
              <li
                key={tipo.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900 truncate">
                      {tipo.nombre}
                    </p>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 tracking-wider ${
                        tipo.estado
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {tipo.estado ? (
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 shrink-0" />
                      )}
                      {tipo.estado ? "ACTIVO" : "INACTIVO"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tipo.roles_permitidos.map((rol) => (
                      <span
                        key={rol}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider"
                      >
                        {capitalizar(rol)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleEstado(tipo.id, tipo.estado)}
                    title={tipo.estado ? "Desactivar" : "Activar"}
                    className={`p-2 rounded-lg transition-colors ${
                      tipo.estado
                        ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                        : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                    }`}
                  >
                    {tipo.estado ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleOpenForm(tipo)}
                    title="Editar"
                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEliminar(tipo.id, tipo.nombre)}
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
    </div>
  );
};
