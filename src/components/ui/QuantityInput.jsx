import { useState } from "react";

/**
 * Input numérico de cantidad que deja borrar y escribir libremente.
 *
 * Un `<input type="number" value={n}>` controlado directamente por el
 * número no permite vaciarlo (el estado se normaliza al instante a 1/0),
 * así que acá se mantiene un borrador de texto mientras el campo tiene el
 * foco. Solo se avisa al padre (`onCommit`) cuando el texto es un número
 * mayor a 0; al salir del campo se vuelve a mostrar el valor real.
 */
export function QuantityInput({ value, onCommit, className = "", ...rest }) {
  const [borrador, setBorrador] = useState(null);

  const handleChange = (e) => {
    const texto = e.target.value;
    setBorrador(texto);

    const numero = Number(texto.replace(",", "."));
    if (texto.trim() !== "" && !Number.isNaN(numero) && numero > 0) {
      onCommit(numero);
    }
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      value={borrador ?? value}
      onChange={handleChange}
      onFocus={(e) => e.target.select()}
      onBlur={() => setBorrador(null)}
      className={className}
      {...rest}
    />
  );
}
