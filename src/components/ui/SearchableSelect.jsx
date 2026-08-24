import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";

const normalizar = (texto) =>
  (texto || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Select con búsqueda por texto. A diferencia de un <input> + <datalist>
 * (poco confiable en Android y que permite dejar texto libre que no
 * coincide con ninguna opción, ver fix(clientes) de ciudad/municipio),
 * este componente SIEMPRE resuelve a un `value` de la lista de opciones o
 * a "" — nunca deja un texto suelto a medio escribir como valor.
 *
 * Componente de presentación puro (SRP): recibe opciones ya cargadas y
 * delega la selección al padre vía onChange, igual que un <select> nativo.
 */
export const SearchableSelect = ({
  options,
  value,
  onChange,
  onBlur,
  placeholder = "Buscar...",
  error = false,
  disabled = false,
  noOptionsMessage = "Sin resultados.",
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value],
  );

  // Mientras no se está buscando activamente, el texto mostrado se deriva
  // directamente de la opción seleccionada (controlada por el padre) en
  // vez de sincronizarse con un efecto — así se refleja de inmediato un
  // cambio externo de `value` (ej. al abrir el form en modo edición) sin
  // el round-trip extra de un useEffect.
  const displayValue = isOpen ? query : selectedOption?.label || "";

  const opcionesFiltradas = useMemo(() => {
    if (!isOpen) return options;
    const q = normalizar(query);
    if (!q || query === selectedOption?.label) return options;
    return options.filter((o) => normalizar(o.label).includes(q));
  }, [options, query, selectedOption, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Al cerrarse (blur, escape, click afuera o tras seleccionar), isOpen
  // pasa a false y displayValue vuelve a derivarse de selectedOption solo
  // — no hace falta "revertir" query a mano en cada uno de esos casos.
  const seleccionar = (option) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleBlur = () => {
    // El mousedown de la opción (más abajo) ya resuelve la selección antes
    // de que este blur corra, así que si llegamos aquí sin seleccionar,
    // se revierte a lo último válido en vez de dejar texto suelto.
    setIsOpen(false);
    onBlur?.();
  };

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setQuery(selectedOption?.label || "");
      setIsOpen(true);
      return;
    }
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        Math.min(prev + 1, opcionesFiltradas.length - 1),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opcion = opcionesFiltradas[highlightedIndex];
      if (opcion) seleccionar(opcion);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={() => {
          setQuery(selectedOption?.label || "");
          setIsOpen(true);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`w-full pl-9 pr-8 py-2.5 border rounded-xl outline-none bg-white text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ${error ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"}`}
      />
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />

      {isOpen && (
        <ul className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1">
          {opcionesFiltradas.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400 italic">
              {noOptionsMessage}
            </li>
          ) : (
            opcionesFiltradas.map((option, index) => (
              <li
                key={option.value}
                // onMouseDown (no onClick) para resolver antes del onBlur del input
                onMouseDown={(e) => {
                  e.preventDefault();
                  seleccionar(option);
                }}
                className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-2 ${
                  option.disabled
                    ? "text-slate-300 cursor-not-allowed"
                    : index === highlightedIndex
                      ? "bg-primary/10 text-primary"
                      : "text-slate-700 hover:bg-slate-50"
                } ${option.value === value ? "font-semibold" : ""}`}
              >
                <span className="truncate">{option.label}</span>
                {option.hint && (
                  <span className="shrink-0 text-xs text-slate-400">
                    {option.hint}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};
