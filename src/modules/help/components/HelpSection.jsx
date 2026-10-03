import { Link } from "react-router-dom";
import { ChevronDown, ArrowRight, Info } from "lucide-react";

const HelpBlock = ({ bloque }) => (
  <div>
    <h3 className="text-sm font-bold text-slate-800">{bloque.titulo}</h3>
    {bloque.pasos?.length > 0 && (
      <ol className="mt-2 space-y-1.5">
        {bloque.pasos.map((paso, i) => (
          <li key={paso} className="flex gap-2.5 text-sm text-slate-600">
            <span className="w-5 h-5 shrink-0 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span>{paso}</span>
          </li>
        ))}
      </ol>
    )}
    {bloque.notas?.length > 0 && (
      <ul className="mt-2 space-y-1.5">
        {bloque.notas.map((nota) => (
          <li key={nota} className="flex gap-2.5 text-sm text-slate-600">
            <Info className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
            <span>{nota}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

/**
 * Sección desplegable del instructivo. Componente de presentación: recibe
 * la sección ya filtrada por rol/búsqueda y si está abierta desde el padre.
 */
export const HelpSection = ({ seccion, abierta, onToggle }) => {
  const Icon = seccion.icono;
  const panelId = `ayuda-panel-${seccion.id}`;

  return (
    <section
      id={`ayuda-${seccion.id}`}
      className="bg-white rounded-xl border border-slate-200 shadow-sm scroll-mt-4"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierta}
        aria-controls={panelId}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left"
      >
        <span className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-slate-900">{seccion.titulo}</span>
          <span className="block text-xs sm:text-sm text-slate-500">{seccion.resumen}</span>
        </span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-slate-400 transition-transform ${abierta ? "rotate-180" : ""}`}
        />
      </button>

      {abierta && (
        <div id={panelId} className="px-4 sm:px-5 pb-5 space-y-5 border-t border-slate-100 pt-4">
          {/* El título no es único entre bloques alternativos por rol. */}
          {seccion.bloques.map((bloque, i) => (
            <HelpBlock key={`${i}-${bloque.titulo}`} bloque={bloque} />
          ))}
          {seccion.ruta && (
            <Link
              to={seccion.ruta}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Ir al módulo <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
};
