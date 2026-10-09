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
 *
 * Con `creatable` el campo además deja AGREGAR un valor nuevo (para
 * catálogos abiertos como tipo/departamento/línea/categoría de un producto):
 * si lo escrito no coincide con ninguna opción —sin distinguir mayúsculas,
 * tildes ni espacios— aparece "Crear «texto»" al final de la lista; si
 * coincide, se usa la opción existente tal cual está escrita, para no
 * generar duplicados como "Bebidas" y "bebidas". Dejar el campo vacío lo
 * limpia, y al salir con un texto sin elegir opción se conserva como valor
 * nuevo (en vez de perderlo). `maxLength` limita lo que se puede escribir.
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
  creatable = false,
  crearMensaje = "Crear",
  maxLength,
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // En modo creatable el valor actual puede no estar en la lista (uno nuevo
  // o heredado): se muestra tal cual en vez de dejar el campo en blanco.
  const selectedOption = useMemo(() => {
    const encontrada = options.find((o) => o.value === value);
    if (encontrada) return encontrada;
    return creatable && value ? { value, label: value } : null;
  }, [options, value, creatable]);

  // Mientras no se está buscando activamente, el texto mostrado se deriva
  // directamente de la opción seleccionada (controlada por el padre) en
  // vez de sincronizarse con un efecto — así se refleja de inmediato un
  // cambio externo de `value` (ej. al abrir el form en modo edición) sin
  // el round-trip extra de un useEffect.
  const displayValue = isOpen ? query : selectedOption?.label || "";

  const opcionesFiltradas = useMemo(() => {
    if (!isOpen) return options;
    const q = normalizar(query.trim());
    if (!q || query === selectedOption?.label) return options;

    const coincidentes = options.filter((o) => normalizar(o.label).includes(q));
    const existeIgual = options.some((o) => normalizar(o.label).trim() === q);
    if (creatable && !existeIgual) {
      return [
        ...coincidentes,
        { value: query.trim(), label: `${crearMensaje} "${query.trim()}"`, esNueva: true },
      ];
    }
    return coincidentes;
  }, [options, query, selectedOption, isOpen, creatable, crearMensaje]);

  // Valor que se conserva al salir del campo sin elegir una opción (solo
  // creatable): vacío limpia; una coincidencia exacta usa la opción ya
  // existente; cualquier otro texto queda como valor nuevo.
  const resolverTextoAlSalir = () => {
    const texto = query.trim();
    if (!texto) return "";
    const existente = options.find((o) => normalizar(o.label).trim() === normalizar(texto));
    return existente ? existente.value : texto;
  };

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
    // se revierte a lo último válido en vez de dejar texto suelto — salvo en
    // modo creatable, donde lo escrito se conserva (ver resolverTextoAlSalir).
    if (creatable && isOpen) {
      const resuelto = resolverTextoAlSalir();
      if (resuelto !== (value || "")) onChange(resuelto);
    }
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
        maxLength={maxLength}
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
                key={option.esNueva ? `__nueva__${option.value}` : option.value}
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
