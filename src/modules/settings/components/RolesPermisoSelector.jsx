import { useState } from "react";
import {
  ROLES_SIEMPRE,
  alternarRol,
  validatePermisoRoles,
} from "../utils/permisosRoles";

/**
 * Casillas para elegir qué perfiles tienen un permiso. Soporte y gerencia
 * siempre lo tienen y se muestran fijos. Valida antes de guardar y solo
 * guarda una lista válida. Presentacional: el guardado lo hace la página.
 */
export const RolesPermisoSelector = ({
  titulo,
  descripcion,
  catalogo,
  roles,
  guardando,
  onChange,
}) => {
  const [error, setError] = useState("");

  const handleToggle = (rol) => {
    const siguiente = alternarRol(roles, rol, catalogo);
    const mensaje = validatePermisoRoles(siguiente, catalogo);
    setError(mensaje);
    if (mensaje) return;
    onChange(siguiente);
  };

  return (
    <fieldset
      disabled={guardando}
      className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200 shadow-sm disabled:opacity-70"
    >
      <legend className="sr-only">{titulo}</legend>
      <p className="text-sm font-bold text-slate-900">{titulo}</p>
      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{descripcion}</p>

      <div className="flex flex-wrap gap-2 mt-3">
        {catalogo.map(({ valor, etiqueta }) => {
          const fijo = ROLES_SIEMPRE.includes(valor);
          const marcado = fijo || roles.includes(valor);
          return (
            <label
              key={valor}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                marcado
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
              } ${fijo ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={marcado}
                disabled={fijo}
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
