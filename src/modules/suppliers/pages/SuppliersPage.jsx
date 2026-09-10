import { useState } from "react";
import { supplierService } from "../services/supplierService";
import { SupplierForm } from "../components/SupplierForm";
import { useToast } from "../../../context/useToast";
import { usePaginatedList } from "../../../hooks/usePaginatedList";
import {
  Truck,
  Search,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit,
  Trash2,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const SuppliersPage = () => {
  const { showError } = useToast();
  const {
    items: proveedores,
    setItems: setProveedores,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    reload: cargarProveedores,
  } = usePaginatedList((page, pageSize, search) =>
    supplierService.getProveedoresPaginados(page, pageSize, search),
  );

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState(null);

  const handleOpenForm = (supplier = null) => {
    setSupplierToEdit(supplier);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSupplierToEdit(null);
    cargarProveedores();
  };

  const handleToggleEstado = async (id, estadoActual) => {
    try {
      setProveedores((prev) =>
        prev.map((p) => (p.id === id ? { ...p, estado: !estadoActual } : p)),
      );
      await supplierService.toggleEstado(id, !estadoActual);
    } catch (err) {
      showError(err.message);
      cargarProveedores();
    }
  };

  const handleEliminar = async (id, nombre) => {
    if (!window.confirm(`¿Seguro que deseas eliminar a ${nombre}?`)) return;
    try {
      setProveedores((prev) => prev.filter((p) => p.id !== id));
      await supplierService.eliminarProveedor(id);
      cargarProveedores();
    } catch (err) {
      showError(err.message);
      cargarProveedores();
    }
  };

  const renderActionButtons = (supplier) => (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => handleToggleEstado(supplier.id, supplier.estado)}
        title={supplier.estado ? "Suspender" : "Activar"}
        className={`p-2 rounded-lg transition-colors ${
          supplier.estado
            ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
            : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
        }`}
      >
        {supplier.estado ? (
          <XCircle className="w-5 h-5 md:w-4 md:h-4" />
        ) : (
          <CheckCircle2 className="w-5 h-5 md:w-4 md:h-4" />
        )}
      </button>
      <button
        onClick={() => handleOpenForm(supplier)}
        title="Editar"
        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
      >
        <Edit className="w-5 h-5 md:w-4 md:h-4" />
      </button>
      <button
        onClick={() => handleEliminar(supplier.id, supplier.nombre_comercial)}
        title="Eliminar"
        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      >
        <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 relative flex flex-col h-full">
      {isFormOpen && (
        <SupplierForm
          supplierToEdit={supplierToEdit}
          onSuccess={handleFormSuccess}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary shrink-0" />
            <span>Proveedores</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Directorio de proveedores para el módulo de compras.
          </p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-bold rounded-xl sm:rounded-lg shadow-sm transition-all"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>Nuevo Proveedor</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold shrink-0">
          {error}
        </div>
      )}

      <div className="bg-transparent md:bg-white md:rounded-xl md:border md:border-slate-200 md:shadow-sm flex flex-col flex-1 min-h-0">
        <div className="bg-white p-3 sm:p-4 rounded-xl md:rounded-none md:rounded-t-xl border border-slate-200 md:border-none md:border-b flex items-center gap-2 sm:gap-3 shrink-0 mb-4 md:mb-0 shadow-sm md:shadow-none">
          <Search className="w-5 h-5 text-slate-400 ml-1 sm:ml-2 shrink-0" />
          <input
            type="text"
            placeholder="Buscar por nombre, identificación, correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none text-base sm:text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium py-1"
          />
          {loading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && proveedores.length === 0 ? (
            <div className="flex-1 p-8 text-center text-slate-500 flex justify-center items-center bg-white rounded-xl md:rounded-none md:border-none border border-slate-200">
              <Loader2 className="w-6 h-6 text-primary animate-spin mr-2" />
              Cargando proveedores...
            </div>
          ) : proveedores.length === 0 ? (
            <div className="flex-1 p-8 text-center text-slate-500 bg-white rounded-xl md:rounded-none md:border-none border border-slate-200 flex items-center justify-center">
              No se encontraron proveedores.
            </div>
          ) : (
            <>
              {/* === VISTA MÓVIL (Tarjetas) === */}
              <div className="block md:hidden flex-1 overflow-y-auto space-y-4 pb-4">
                {proveedores.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 relative"
                  >
                    <div className="flex justify-between items-start gap-2 pr-16">
                      <div>
                        <p className="font-bold text-slate-900 text-lg leading-tight">
                          {supplier.nombre_comercial}
                        </p>
                        <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                          {supplier.numero_identificacion}
                        </span>
                      </div>
                    </div>

                    <div className="absolute top-4 right-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shadow-sm ${
                          supplier.estado
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {supplier.estado ? "ACTIVO" : "INACTIVO"}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2 mt-1">
                      {supplier.contacto_nombre && (
                        <p className="text-sm font-medium text-slate-800">
                          {supplier.contacto_nombre}
                        </p>
                      )}
                      {supplier.telefono && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          {supplier.telefono}
                        </div>
                      )}
                      {supplier.correo && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          {supplier.correo}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 mt-1">
                      {renderActionButtons(supplier)}
                    </div>
                  </div>
                ))}
              </div>

              {/* === VISTA ESCRITORIO (Tabla) === */}
              <div className="hidden md:block flex-1 overflow-x-auto bg-white">
                <table className="w-full text-left border-collapse min-w-175">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                      <th className="py-3.5 px-6">Proveedor</th>
                      <th className="py-3.5 px-6">Identificación</th>
                      <th className="py-3.5 px-6">Contacto</th>
                      <th className="py-3.5 px-6">Estado</th>
                      <th className="py-3.5 px-6 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {proveedores.map((supplier) => (
                      <tr
                        key={supplier.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-4 px-6">
                          <p className="font-bold text-slate-900">
                            {supplier.nombre_comercial}
                          </p>
                          {supplier.contacto_nombre && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {supplier.contacto_nombre}
                            </p>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <p className="font-bold text-slate-700">
                            {supplier.numero_identificacion}
                          </p>
                        </td>
                        <td className="py-4 px-6 text-slate-600">
                          {supplier.telefono && (
                            <p className="text-xs font-semibold">
                              {supplier.telefono}
                            </p>
                          )}
                          {supplier.correo && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {supplier.correo}
                            </p>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 tracking-wider ${
                              supplier.estado
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {supplier.estado ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 shrink-0" />{" "}
                                ACTIVO
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 shrink-0" />{" "}
                                INACTIVO
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {renderActionButtons(supplier)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 bg-white md:bg-slate-50 md:rounded-b-xl flex items-center justify-between text-sm shrink-0 mt-4 md:mt-0 rounded-xl shadow-sm md:shadow-none">
            <span className="text-slate-500 font-medium">
              Página {currentPage} de {totalPages}{" "}
              <span className="hidden sm:inline">({totalItems} registros)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || loading}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
