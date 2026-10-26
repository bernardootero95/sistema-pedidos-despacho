import { Search } from "lucide-react";

/** Búsqueda por código/nombre y filtro por categoría de la lista de precios. */
export const PriceListFilters = ({ busqueda, categoria, categorias, onBusquedaChange, onCategoriaChange }) => (
  <div className="flex flex-col sm:flex-row gap-3">
    <div className="relative w-full sm:max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      <input
        type="search"
        value={busqueda}
        onChange={(e) => onBusquedaChange(e.target.value)}
        placeholder="Buscar por código o nombre"
        aria-label="Buscar producto"
        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl outline-none text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
    </div>
    <select
      value={categoria}
      onChange={(e) => onCategoriaChange(e.target.value)}
      aria-label="Filtrar por categoría"
      className="w-full sm:w-56 px-3 py-2.5 border border-slate-300 rounded-xl outline-none text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
    >
      <option value="">Todas las categorías</option>
      {categorias.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  </div>
);
