import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { orderService } from "../services/orderService";

/**
 * Muestra el número de la orden de despacho más reciente a la que fue
 * asignado el pedido. Enlaza al detalle del despacho solo si el usuario
 * tiene permiso para verlo (`puedeVerDespacho`, alineado a
 * ROLES_MODULO.DESPACHOS); para el resto se muestra como texto plano. No
 * renderiza nada si el pedido sigue pendiente o nunca se asignó a una ruta.
 */
export const OrderDispatchInfo = ({ pedido, puedeVerDespacho }) => {
  const [despacho, setDespacho] = useState(null);

  useEffect(() => {
    if (pedido.estado === "pendiente") return;

    let activo = true;
    orderService
      .obtenerDespachoDePedido(pedido.id)
      .then((data) => {
        if (activo) setDespacho(data);
      })
      .catch(() => {});

    return () => {
      activo = false;
    };
  }, [pedido.id, pedido.estado]);

  if (!despacho) return null;

  return (
    <div className="pt-2 border-t border-slate-100">
      <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">
        <Truck className="h-3.5 w-3.5 text-blue-600" />
        Orden de Despacho:
      </p>
      {puedeVerDespacho ? (
        <Link
          to={`/despachos/${despacho.id}`}
          className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
        >
          {despacho.codigo_despacho}
        </Link>
      ) : (
        <p className="text-sm font-semibold text-slate-800">
          {despacho.codigo_despacho}
        </p>
      )}
    </div>
  );
};
