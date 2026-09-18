import { Tag, Loader2 } from "lucide-react";

const capitalizar = (rol) => rol.charAt(0).toUpperCase() + rol.slice(1);

/**
 * Sección "Precios Diferenciados" de los formularios de producto: un input
 * opcional por cada tipo de precio activo del catálogo. Componente de
 * presentación: el estado vive en usePreciosPersonalizados.
 */
export const PreciosDiferenciadosSection = ({
  tiposPrecio,
  valores,
  errores,
  loading,
  loadError,
  onChange,
  onBlur,
}) => (
  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
        <Tag className="w-3.5 h-3.5" />
        Precios Diferenciados (Opcional)
      </h3>
      <p className="text-xs text-slate-400 mt-0.5">
        Cada tipo solo lo pueden aplicar los roles definidos en su
        configuración.
      </p>
    </div>

    {loading ? (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando tipos de precio...
      </div>
    ) : loadError ? (
      <p className="text-xs text-red-500 font-bold">{loadError}</p>
    ) : tiposPrecio.length === 0 ? (
      <p className="text-xs text-slate-400 italic">
        No hay tipos de precio activos. Soporte o gerencia pueden crearlos en
        Tipos de Precio.
      </p>
    ) : (
      <div className="@container">
        <div className="grid grid-cols-1 @md:grid-cols-2 gap-4">
          {tiposPrecio.map((tipo) => (
            <div key={tipo.id}>
              <label
                htmlFor={`precio-tipo-${tipo.id}`}
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                {tipo.nombre}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  $
                </span>
                <input
                  id={`precio-tipo-${tipo.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={valores[tipo.id] ?? ""}
                  onChange={(e) => onChange(tipo.id, e.target.value)}
                  onBlur={() => onBlur(tipo.id)}
                  className={`w-full pl-8 p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errores[tipo.id] ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                />
              </div>
              {errores[tipo.id] ? (
                <p className="mt-1 text-xs text-red-500 font-bold">
                  {errores[tipo.id]}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-400">
                  Aplican: {tipo.roles_permitidos.map(capitalizar).join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);
