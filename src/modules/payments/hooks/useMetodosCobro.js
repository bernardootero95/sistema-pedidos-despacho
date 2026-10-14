import { useMemo } from "react";
import { useAuth } from "../../../context/useAuth";
import { useSettings } from "../../../context/useSettings";
import { metodosParaCobro } from "../utils/paymentLines";

/**
 * Métodos que se ofrecen al COBRAR un pedido al entregarlo (ver
 * metodosParaCobro): incluye 'Crédito' solo para quien tiene el permiso.
 */
export const useMetodosCobro = () => {
  const { user } = useAuth();
  const { metodosPago, metodoCredito, metodosPagoActivo, abonosPedidosActivo } =
    useSettings();
  const puedeDarCredito = user?.puedeDarCredito === true;

  return useMemo(
    () =>
      metodosParaCobro({
        metodosPago,
        metodoCredito,
        metodosPagoActivo,
        abonosPedidosActivo,
        puedeDarCredito,
      }),
    [
      metodosPago,
      metodoCredito,
      metodosPagoActivo,
      abonosPedidosActivo,
      puedeDarCredito,
    ],
  );
};
