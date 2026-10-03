import { useMemo, useState } from "react";
import { BookOpen, Search, X, SearchX } from "lucide-react";
import { useAuth } from "../../../context/useAuth";
import { useSettings } from "../../../context/useSettings";
import { HelpSection } from "../components/HelpSection";
import { SECCIONES_AYUDA } from "../utils/helpContent";
import { getSeccionesVisibles } from "../utils/helpFilter";

/**
 * Instructivo del sistema, adaptado al rol del usuario y a las opciones que
 * la empresa tiene encendidas. El contenido es estático (helpContent.js), así
 * que la búsqueda filtra en memoria sin debounce ni llamadas de red.
 */
export const HelpPage = () => {
  const { user } = useAuth();
  const settings = useSettings();
  const [busqueda, setBusqueda] = useState("");
  const [abiertas, setAbiertas] = useState(() => new Set(["primeros-pasos"]));

  const secciones = useMemo(
    () => getSeccionesVisibles(SECCIONES_AYUDA, user?.rol, settings, busqueda),
    [user?.rol, settings, busqueda],
  );
  // Con búsqueda activa se despliega todo lo que coincide.
  const buscando = busqueda.trim() !== "";

  const toggle = (id) =>
    setAbiertas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  const irASeccion = (id) => {
    setAbiertas((prev) => new Set(prev).add(id));
    document
      .getElementById(`ayuda-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary shrink-0" />
            <span>Instructivo</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Guía de uso del sistema según tu rol. Busca un tema o abre una sección.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej: anular pedido, factura, contraseña..."
            aria-label="Buscar en el instructivo"
            className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {buscando && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {!buscando && secciones.length > 1 && (
          <nav aria-label="Secciones del instructivo" className="flex flex-wrap gap-2">
            {secciones.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => irASeccion(s.id)}
                className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
              >
                {s.titulo}
              </button>
            ))}
          </nav>
        )}
      </div>

      {secciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center text-slate-500">
          <SearchX className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-semibold">
            No encontramos temas para «{busqueda.trim()}».
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {secciones.map((seccion) => (
            <HelpSection
              key={seccion.id}
              seccion={seccion}
              abierta={buscando || abiertas.has(seccion.id)}
              onToggle={() => toggle(seccion.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
