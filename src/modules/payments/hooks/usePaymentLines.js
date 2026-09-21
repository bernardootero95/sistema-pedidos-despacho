import { useState, useMemo, useCallback } from "react";
import {
  MODOS_PAGO,
  crearLinea,
  lineasAPayload,
  sumarLineas,
  validarLineas,
} from "../utils/paymentLines";

/**
 * Estado y validación de las líneas de pago de una operación (cobro al
 * entregar, abono, pago de una compra...). Los errores de una línea se
 * muestran solo después de tocar el campo o de intentar confirmar, igual que
 * el resto de formularios del proyecto.
 *
 * Pensado para montarse cuando se abre el diálogo: `objetivo` solo se usa
 * para precargar la primera línea (en modo exacto, el saldo completo).
 */
export const usePaymentLines = ({ objetivo, modo, metodosActivo }) => {
  const [lineas, setLineas] = useState(() => [
    crearLinea(modo === MODOS_PAGO.EXACTO ? objetivo : ""),
  ]);
  const [tocados, setTocados] = useState({});
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  const resultado = useMemo(
    () => validarLineas(lineas, { modo, objetivo, metodosActivo }),
    [lineas, modo, objetivo, metodosActivo],
  );

  const errores = useMemo(() => {
    const visibles = {};
    Object.entries(resultado.porLinea).forEach(([key, errsLinea]) => {
      visibles[key] = {};
      Object.entries(errsLinea).forEach(([campo, mensaje]) => {
        if (intentoEnvio || tocados[key]?.[campo]) visibles[key][campo] = mensaje;
      });
    });
    return visibles;
  }, [resultado, tocados, intentoEnvio]);

  const total = useMemo(() => sumarLineas(lineas), [lineas]);
  const payload = useMemo(() => lineasAPayload(lineas), [lineas]);

  const cambiar = useCallback((key, campo, valor) => {
    setLineas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)),
    );
  }, []);

  const tocar = useCallback((key, campo) => {
    setTocados((prev) => ({ ...prev, [key]: { ...prev[key], [campo]: true } }));
  }, []);

  // Una línea nueva sugiere lo que aún falta por cubrir.
  const agregar = useCallback(() => {
    setLineas((prev) => {
      const faltante = Math.max(objetivo - sumarLineas(prev), 0);
      return [...prev, crearLinea(faltante > 0 ? faltante : "")];
    });
  }, [objetivo]);

  const quitar = useCallback((key) => {
    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }, []);

  // Rellena la línea con lo que falta por cubrir descontando las demás.
  const completar = useCallback(
    (key) => {
      setLineas((prev) => {
        const otras = sumarLineas(prev.filter((l) => l.key !== key));
        const faltante = Math.max(objetivo - otras, 0);
        return prev.map((l) => (l.key === key ? { ...l, monto: String(faltante) } : l));
      });
      tocar(key, "monto");
    },
    [objetivo, tocar],
  );

  const validar = useCallback(() => {
    setIntentoEnvio(true);
    return resultado.valido;
  }, [resultado.valido]);

  return {
    lineas,
    errores,
    errorGeneral: intentoEnvio ? resultado.general : "",
    total,
    payload,
    cambiar,
    tocar,
    agregar,
    quitar,
    completar,
    validar,
  };
};
