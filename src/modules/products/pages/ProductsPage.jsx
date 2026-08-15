import { useState } from "react";
import { productService } from "../services/productService";
import { ProductForm } from "../components/ProductForm";
import { useToast } from "../../../context/useToast";
import { usePaginatedList } from "../../../hooks/usePaginatedList";
import {
  Package,
  Search,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit,
  Trash2,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Tag,
  AlertTriangle,
} from "lucide-react";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const ProductDetailsModal = ({ product, onClose }) => {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Package className="text-primary w-5 h-5" />
            Ficha Técnica del Producto
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                {product.codigo}
              </span>
              {product.codigo_barra && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  BARCODE: {product.codigo_barra}
                </span>
              )}
            </div>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {product.nombre}
            </h3>
            {product.descripcion && (
              <p className="text-slate-500 mt-2">{product.descripcion}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <h4 className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5 mb-2">
                <Tag className="w-4 h-4" /> Clasificación
              </h4>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Tipo
                </p>
                <p className="font-semibold text-slate-800">
                  {product.tipo || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Categoría
                </p>
                <p className="font-semibold text-slate-800">
                  {product.categoria || "Sin categoría"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Dpto / Línea
                </p>
                <p className="font-semibold text-slate-800">
                  {product.departamento || "N/A"}{" "}
                  {product.linea ? ` / ${product.linea}` : ""}
                </p>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
              <h4 className="text-xs font-bold uppercase text-emerald-600 flex items-center gap-1.5 mb-2">
                Datos Fiscales y Stock
              </h4>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Precio Base de Venta
                </p>
                <p className="text-lg font-black text-emerald-700">
                  {formatCurrency(product.precio_venta)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Clasif. DIAN
                  </p>
                  <p className="font-bold text-slate-800 capitalize">
                    {product.clasificacion}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Impuestos
                  </p>
                  <p className="font-bold text-slate-800">
                    IVA: {product.iva}% | INC: {product.inc}%
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-emerald-200/50 mt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                  Stock Disponible
                </p>
                <p
                  className={`text-base font-black flex items-center gap-2 ${product.disponible > 0 ? "text-slate-800" : "text-red-600"}`}
                >
                  {product.disponible} Unidades
                  {product.disponible === 0 && (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProductsPage = () => {
  const { showError } = useToast();
  const {
    items: productos,
    setItems: setProductos,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    reload: cargarProductos,
  } = usePaginatedList((page, pageSize, search) =>
    productService.getProductosPaginados(page, pageSize, search),
  );

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [productToView, setProductToView] = useState(null);

  const handleOpenForm = (product = null) => {
    setProductToEdit(product);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setProductToEdit(null);
    cargarProductos();
  };

  const handleToggleEstado = async (id, estadoActual) => {
    try {
      setProductos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, estado: !estadoActual } : p)),
      );
      await productService.toggleEstado(id, !estadoActual);
    } catch (err) {
      showError(err.message);
      cargarProductos();
    }
  };

  const handleEliminar = async (id, nombre) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el producto "${nombre}"?`))
      return;
    try {
      setProductos((prev) => prev.filter((p) => p.id !== id));
      await productService.eliminarProducto(id);
      cargarProductos();
    } catch (err) {
      showError(err.message);
      cargarProductos();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 relative">
      {isFormOpen && (
        <ProductForm
          productToEdit={productToEdit}
          onSuccess={handleFormSuccess}
          onCancel={() => setIsFormOpen(false)}
        />
      )}
      <ProductDetailsModal
        product={productToView}
        onClose={() => setProductToView(null)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-primary shrink-0" />
            <span>Inventario y Productos</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Administración de catálogo, stock e impuestos (DIAN).
          </p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-bold rounded-xl sm:rounded-lg shadow-sm transition-all"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold">
          {error}
        </div>
      )}

      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-3">
        <Search className="w-5 h-5 text-slate-400 ml-1 sm:ml-2 shrink-0" />
        <input
          type="text"
          placeholder="Buscar por código, nombre o código de barras..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent border-none text-base sm:text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium py-1"
        />
        {loading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="block sm:hidden divide-y divide-slate-200">
          {productos.length === 0 && !loading && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No se encontraron productos.
            </div>
          )}
          {productos.map((product) => (
            <div key={product.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black text-slate-400 tracking-wider mb-1 block">
                    {product.codigo}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm leading-snug">
                    {product.nombre}
                  </h4>
                </div>
                <span
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 ${product.disponible > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                >
                  STOCK: {product.disponible}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                <span className="font-bold text-slate-800">
                  {formatCurrency(product.precio_venta)}
                </span>
                <span className="text-slate-500 font-semibold">
                  {product.clasificacion}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span
                  className={`text-xs font-bold flex items-center gap-1 ${product.estado ? "text-emerald-600" : "text-red-500"}`}
                >
                  {product.estado ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Activo
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> Inactivo
                    </>
                  )}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setProductToView(product)}
                    className="p-2 text-slate-400 hover:text-primary bg-slate-50 rounded-lg"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenForm(product)}
                    className="p-2 text-primary hover:bg-primary/10 bg-primary/5 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEliminar(product.id, product.nombre)}
                    className="p-2 text-red-500 hover:bg-red-100 bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-225">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">Código / Producto</th>
                <th className="py-3.5 px-6">Categoría</th>
                <th className="py-3.5 px-6">Fiscal / Precio</th>
                <th className="py-3.5 px-6 text-center">Stock</th>
                <th className="py-3.5 px-6 text-center">Estado</th>
                <th className="py-3.5 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {productos.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">
                    No se encontraron productos en la búsqueda.
                  </td>
                </tr>
              )}
              {productos.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-4 px-6">
                    <p className="text-[10px] font-black text-slate-400 tracking-wider mb-0.5">
                      {product.codigo}
                    </p>
                    <p className="font-bold text-slate-900">{product.nombre}</p>
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-semibold text-slate-700">
                      {product.categoria || "Sin categoría"}
                    </p>
                    {product.tipo && (
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                        {product.tipo}
                      </p>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-bold text-emerald-700">
                      {formatCurrency(product.precio_venta)}
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase">
                      {product.clasificacion} (IVA: {product.iva}% | INC:{" "}
                      {product.inc}%)
                    </p>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span
                      className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-black w-14 ${product.disponible > 0 ? "bg-slate-100 text-slate-700" : "bg-red-100 text-red-700"}`}
                    >
                      {product.disponible}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${product.estado ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
                    >
                      {product.estado ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Activo
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" /> Inactivo
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setProductToView(product)}
                        title="Ver detalles"
                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleToggleEstado(product.id, product.estado)
                        }
                        title={product.estado ? "Suspender" : "Activar"}
                        className={`p-2 rounded-lg transition-colors ${product.estado ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"}`}
                      >
                        {product.estado ? (
                          <XCircle className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenForm(product)}
                        title="Editar"
                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleEliminar(product.id, product.nombre)
                        }
                        title="Eliminar"
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-sm">
            <span className="text-slate-500 font-medium">
              Mostrando página {currentPage} de {totalPages}{" "}
              <span className="hidden sm:inline">({totalItems} registros)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
