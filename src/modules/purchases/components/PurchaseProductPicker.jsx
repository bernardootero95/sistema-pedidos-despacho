import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";

/**
 * Selector de producto + cantidad + costo unitario para armar el carrito
 * de una compra. A diferencia de ProductSearchBar (pedidos) no muestra ni
 * valida el stock disponible: comprar siempre suma, no hay tope.
 * Componente de presentación puro (SRP): el padre decide qué hacer con la
 * línea vía onAgregar.
 */
export const PurchaseProductPicker = ({ productos, onAgregar, error }) => {
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");

  const opciones = useMemo(
    () =>
      productos.map((p) => ({
        value: p.id,
        label: `${p.codigo} - ${p.nombre}`,
      })),
    [productos],
  );

  const productoSeleccionado = productos.find((p) => p.id === productoId);
  const puedeAgregar =
    productoSeleccionado && Number(cantidad) > 0 && Number(costoUnitario) >= 0;

  const handleAgregar = () => {
    if (!puedeAgregar) return;
    onAgregar(productoSeleccionado, Number(cantidad), Number(costoUnitario));
    setProductoId("");
    setCantidad("");
    setCostoUnitario("");
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
        Agregar Productos a la Compra
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <SearchableSelect
            options={opciones}
            value={productoId}
            onChange={setProductoId}
            placeholder="Buscar por código o nombre..."
            noOptionsMessage="Ningún producto coincide con la búsqueda."
          />
        </div>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Cantidad"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="w-full sm:w-32 p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Costo unitario"
          value={costoUnitario}
          onChange={(e) => setCostoUnitario(e.target.value)}
          className="w-full sm:w-36 p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm"
        />
        <button
          type="button"
          onClick={handleAgregar}
          disabled={!puedeAgregar}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shrink-0"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {error && (
        <p className="text-red-500 text-sm mt-2 font-medium">{error}</p>
      )}
    </div>
  );
};
