import { useMemo } from "react";
import { Plus } from "lucide-react";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";

/**
 * Buscador de productos con stock visible y botón de agregar al carrito.
 * Componente puramente de presentación (SRP): recibe el catálogo y los
 * manejadores desde el padre, no gestiona su propio estado ni valida.
 */
export const ProductSearchBar = ({
  productos,
  productoSeleccionado,
  onSelectChange,
  onAgregar,
  error,
  formatCurrency,
}) => {
  const opciones = useMemo(
    () =>
      productos.map((p) => ({
        value: p.id,
        label: `${p.codigo} - ${p.nombre} (${formatCurrency(p.precio_venta)}) [Stock: ${p.disponible}]${p.disponible <= 0 ? " (AGOTADO)" : ""}`,
        disabled: p.disponible <= 0,
      })),
    [productos, formatCurrency],
  );

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
        Agregar Productos
      </label>
      <div className="flex gap-2">
        <div className="flex-1">
          <SearchableSelect
            options={opciones}
            value={productoSeleccionado}
            onChange={onSelectChange}
            placeholder="Buscar por código o nombre..."
            noOptionsMessage="Ningún producto coincide con la búsqueda."
          />
        </div>
        <button
          type="button"
          onClick={onAgregar}
          disabled={!productoSeleccionado}
          className="bg-blue-600 text-white px-5 py-3 rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
      {error && (
        <p className="text-red-500 text-sm mt-2 font-medium">{error}</p>
      )}
    </div>
  );
};
