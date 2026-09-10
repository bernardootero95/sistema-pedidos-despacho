import { useState, useMemo } from "react";

/**
 * Estado local del carrito de una compra: lista de líneas
 * {producto_id, codigo, nombre, cantidad, costo_unitario}. Más simple que
 * useCarritoPedido (pedidos): comprar solo suma stock, así que no hay
 * franjas de precio ni tope contra `disponible` que resolver por línea.
 *
 * Si el producto ya está en el carrito, agregar vuelve a sobrescribir
 * cantidad/costo en vez de duplicar la línea — evita dos líneas del mismo
 * producto en la misma compra, que solo confundiría el detalle.
 */
export function usePurchaseCart() {
  const [carrito, setCarrito] = useState([]);

  const agregarLinea = (producto, cantidad, costoUnitario) => {
    if (!producto || !cantidad || cantidad <= 0) return;
    if (costoUnitario == null || costoUnitario < 0) return;

    setCarrito((prev) => {
      const existente = prev.findIndex((l) => l.producto_id === producto.id);
      const nuevaLinea = {
        producto_id: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        cantidad,
        costo_unitario: costoUnitario,
      };
      if (existente === -1) return [...prev, nuevaLinea];
      const copia = [...prev];
      copia[existente] = nuevaLinea;
      return copia;
    });
  };

  const actualizarCantidad = (productoId, cantidad) => {
    setCarrito((prev) =>
      prev.map((l) =>
        l.producto_id === productoId ? { ...l, cantidad } : l,
      ),
    );
  };

  const actualizarCosto = (productoId, costoUnitario) => {
    setCarrito((prev) =>
      prev.map((l) =>
        l.producto_id === productoId
          ? { ...l, costo_unitario: costoUnitario }
          : l,
      ),
    );
  };

  const eliminarLinea = (productoId) => {
    setCarrito((prev) => prev.filter((l) => l.producto_id !== productoId));
  };

  const total = useMemo(
    () =>
      carrito.reduce(
        (acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.costo_unitario) || 0),
        0,
      ),
    [carrito],
  );

  return {
    carrito,
    agregarLinea,
    actualizarCantidad,
    actualizarCosto,
    eliminarLinea,
    total,
  };
}
