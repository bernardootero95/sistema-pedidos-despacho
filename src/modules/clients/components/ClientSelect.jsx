import { useMemo } from "react";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";
import { getNombreCliente } from "../utils/clienteDisplay";

/**
 * Selector de cliente con búsqueda: se filtra mientras se escribe, por nombre
 * o por número de identificación (el texto de cada opción incluye ambos).
 * Compartido por pedidos y cotizaciones para no duplicar el mapeo.
 */
export const ClientSelect = ({
  clientes,
  value,
  onChange,
  onBlur,
  error = false,
  placeholder = "Escribe el nombre o NIT del cliente...",
}) => {
  const options = useMemo(
    () =>
      clientes.map((c) => ({
        value: c.id,
        label: `${c.numero_identificacion} - ${getNombreCliente(c)}`,
      })),
    [clientes],
  );

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      error={error}
      placeholder={placeholder}
      noOptionsMessage="Ningún cliente coincide con la búsqueda."
    />
  );
};
