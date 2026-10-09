import { useState } from "react";
import { ROLES_PRECIO_MANUAL, alternarRol, validatePrecioManualRoles } from "../utils/precioManualRoles";

/**
 * Casillas para elegir qué perfiles pueden cambiar el precio al vender.
 * Valida al marcar/desmarcar (no deja quitar el último perfil) y solo guarda
 * una lista válida. Presentacional: el guardado lo hace la página.
 */
export const PrecioManualRolesSelector = ({ roles, guardando, onChange }) => {
  const [error, setError] = useState("");

  const handleToggle = (rol) => {
    const siguiente = alternarRol(roles, rol);
    const mensaje = validatePrecioManualRoles(siguiente);
    setError(mensaje);
    if (mensaje) return;
    onChange(siguiente);
  };

  return (
    <fieldset
      disabled={guardando}
      className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200 shadow-sm disabled:opacity-70"
    >
      <legend className="sr-only">Perfiles que pueden cambiar el precio</legend>
      <p className="text-sm font-bold text-slate-900">Perfiles que pueden cambiar el precio</p>
      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
        Solo ellos verán el lápiz junto al precio al tomar o editar un pedido.
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        {ROLES_PRECIO_MANUAL.map(({ valor, etiqueta }) => {
          const marcado = roles.includes(valor);
          return (
            <label
              key={valor}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                marcado
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <input
                type="checkbox"
                checked={marcado}
                onChange={() => handleToggle(valor)}
                className="h-4 w-4 accent-primary"
              />
              {etiqueta}
            </label>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </fieldset>
  );
};
