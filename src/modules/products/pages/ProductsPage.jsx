import React, { useState } from "react";
import { DEMO_DATA } from "../../../mock/demoData";
import {
  Package,
  Search,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Tag,
} from "lucide-react";

export const ProductsPage = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = DEMO_DATA.productos.filter(
    (prod) =>
      prod.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.categoria.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-primary flex-shrink-0" />
            <span>Catálogo e Inventario</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Control de SKUs, precios de venta y existencias disponibles en
            almacén.
          </p>
        </div>
        <button
          onClick={() =>
            alert(
              "La adición de productos estará disponible al conectar la base de datos.",
            )
          }
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-sm font-semibold rounded-xl sm:rounded-lg shadow-sm transition-all min-h-[44px]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* FILTRO DE BÚSQUEDA TOUCH-OPTIMIZED */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 sm:gap-3">
        <Search className="w-5 h-5 text-slate-400 ml-1 sm:ml-2 flex-shrink-0" />
        <input
          type="text"
          placeholder="Buscar por código SKU, nombre o categoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent border-none text-base sm:text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium py-1"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 bg-slate-100 rounded-lg font-semibold flex-shrink-0"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* GRILLA DE PRODUCTOS (Totalmente Fluida) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((prod) => {
            const isLowStock = prod.stock < 25;
            return (
              <div
                key={prod.id}
                className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-mono font-bold text-xs rounded border border-slate-200">
                      {prod.sku}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Tag className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      {prod.categoria}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                    {prod.nombre}
                  </h3>
                </div>

                <div className="mt-5 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Precio Unitario
                    </span>
                    <span className="text-base sm:text-lg font-black text-slate-900">
                      {formatCurrency(prod.precio)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Stock
                    </span>
                    {isLowStock ? (
                      <span
                        className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold text-xs rounded-full inline-flex items-center gap-1"
                        title="Stock Bajo"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />{" "}
                        {prod.stock} unds
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />{" "}
                        {prod.stock} unds
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white p-8 sm:p-12 text-center rounded-xl border border-slate-200 text-slate-500 font-medium text-sm">
            No se encontraron products coincidentes con "{searchTerm}".
          </div>
        )}
      </div>
    </div>
  );
};
