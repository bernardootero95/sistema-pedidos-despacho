import { useState } from "react";
import {
  validarStockParaAgregar,
  validarStockParaCantidad,
} from "../utils/orderValidations";

/**
 * Resuelve, en el cliente, qué precio de una franja mayorista aplicaría
 * para una cantidad dada — solo para mostrar un preview inmediato en el
 * carrito. La fuente de verdad real vive en resolver_precio_pedido en el
 * servidor (crear/editar_pedido_transaccional), que recalcula todo desde
 * cero sin confiar en este valor.
 */
const resolverPrecioMayoristaPreview = (tiersMayoristas, cantidad) => {
  if (!tiersMayoristas || tiersMayoristas.length === 0) return null;

  const calificantes = tiersMayoristas.filter(
    (t) => t.cantidad_minima <= cantidad,
  );

  // Si alguna franja califica por cantidad, se usa la de mayor umbral; si
  // ninguna califica (se está forzando mayorista igual), se usa la más
  // económica disponible — mismo criterio que resolver_precio_pedido.
  if (calificantes.length > 0) {
    return calificantes.reduce((mayor, t) =>
      t.cantidad_minima > mayor.cantidad_minima ? t : mayor,
    ).precio;
  }
  return tiersMayoristas.reduce((menor, t) =>
    t.cantidad_minima < menor.cantidad_minima ? t : menor,
  ).precio;
};

/** Precio unitario vigente de una línea al cambiar su cantidad: si está en
 * modo mayorista, se re-resuelve la franja para la nueva cantidad; en
 * cualquier otro modo el precio no depende de la cantidad. */
const precioParaCantidad = (item, cantidad) => {
  if (item.tipo_precio !== "mayorista") return item.precio_unitario;
  return (
    resolverPrecioMayoristaPreview(item.tiersMayoristas, cantidad) ??
    item.precio_unitario
  );
};

/**
 * Estado y lógica del carrito de un pedido (agregar/quitar/ajustar
 * cantidad con validación de stock inline). Compartido entre
 * OrderCreatePage y OrderEditPage para no duplicar esta lógica dos veces.
 *
 * `productos` debe traer `disponible` ya ajustado al "techo real" que le
 * corresponde a quien llama: en edición, la cantidad que el propio pedido
 * ya tenía reservada de un producto se suma de vuelta antes de pasarla
 * acá (ver OrderEditPage) — porque editar_pedido_transaccional devuelve
 * esas unidades al stock antes de re-validar, así que el vendedor debe
 * poder subir hasta ese techo, no solo hasta el disponible "crudo".
 */
export function useCarritoPedido(productos, itemsIniciales = []) {
  const [carrito, setCarrito] = useState(itemsIniciales);
  const [errorStock, setErrorStock] = useState("");

  const agregarAlCarrito = (productoId) => {
    if (!productoId) return;

    const producto = productos.find((p) => p.id === productoId);
    if (!producto) return;

    const existeIndex = carrito.findIndex(
      (item) => item.producto_id === producto.id,
    );
    const cantidadEnCarrito =
      existeIndex >= 0 ? carrito[existeIndex].cantidad : 0;

    const stockError = validarStockParaAgregar(producto, cantidadEnCarrito);
    if (stockError) {
      setErrorStock(stockError);
      return;
    }

    if (existeIndex >= 0) {
      setCarrito((prev) => {
        const nuevo = [...prev];
        const item = nuevo[existeIndex];
        const cantidad = item.cantidad + 1;
        const precio_unitario = precioParaCantidad(item, cantidad);
        nuevo[existeIndex] = {
          ...item,
          cantidad,
          precio_unitario,
          subtotal_linea: cantidad * precio_unitario,
        };
        return nuevo;
      });
    } else {
      setCarrito((prev) => [
        ...prev,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          codigo: producto.codigo,
          cantidad: 1,
          precio_unitario: producto.precio_venta,
          iva_porcentaje: producto.iva || 0,
          inc_porcentaje: producto.inc || 0,
          subtotal_linea: producto.precio_venta * 1,
          disponible: producto.disponible,
          tipo_precio: "normal",
          precio_venta: producto.precio_venta,
          precio_frio: producto.precio_frio ?? null,
          tiersMayoristas: producto.tiersMayoristas || [],
        },
      ]);
    }

    setErrorStock("");
  };

  const modificarCantidad = (index, delta) => {
    const item = carrito[index];
    const nuevaCantidad = item.cantidad + delta;

    if (nuevaCantidad <= 0) {
      eliminarDelCarrito(index);
      return;
    }

    const stockError = validarStockParaCantidad(
      nuevaCantidad,
      item.disponible,
      item.nombre,
    );
    if (stockError) {
      setErrorStock(stockError);
      return;
    }

    setCarrito((prev) => {
      const nuevo = [...prev];
      const precio_unitario = precioParaCantidad(item, nuevaCantidad);
      nuevo[index] = {
        ...item,
        cantidad: nuevaCantidad,
        precio_unitario,
        subtotal_linea: nuevaCantidad * precio_unitario,
      };
      return nuevo;
    });
    setErrorStock("");
  };

  const actualizarCantidadInput = (index, valorTexto) => {
    const cantidadStr = valorTexto.toString().replace(/\D/g, "");
    const cantidad = cantidadStr === "" ? 1 : Number(cantidadStr);
    const item = carrito[index];

    const stockError = validarStockParaCantidad(
      cantidad,
      item.disponible,
      item.nombre,
    );
    const cantidadFinal = stockError ? item.disponible : cantidad;
    setErrorStock(stockError || "");

    setCarrito((prev) => {
      const nuevo = [...prev];
      const precio_unitario = precioParaCantidad(item, cantidadFinal);
      nuevo[index] = {
        ...item,
        cantidad: cantidadFinal,
        precio_unitario,
        subtotal_linea: cantidadFinal * precio_unitario,
      };
      return nuevo;
    });
  };

  /**
   * Cambia el tipo de precio (normal/mayorista/frio) de una línea ya
   * agregada. El precio mostrado es solo un preview local — el servidor
   * lo recalcula de todas formas al guardar (ver resolver_precio_pedido).
   */
  const cambiarTipoPrecio = (index, tipoPrecio) => {
    setCarrito((prev) => {
      const nuevo = [...prev];
      const item = nuevo[index];
      let precio_unitario = item.precio_venta;

      if (tipoPrecio === "frio" && item.precio_frio != null) {
        precio_unitario = item.precio_frio;
      } else if (tipoPrecio === "mayorista") {
        precio_unitario =
          resolverPrecioMayoristaPreview(item.tiersMayoristas, item.cantidad) ??
          item.precio_venta;
      }

      nuevo[index] = {
        ...item,
        tipo_precio: tipoPrecio,
        precio_unitario,
        subtotal_linea: item.cantidad * precio_unitario,
      };
      return nuevo;
    });
  };

  const eliminarDelCarrito = (index) => {
    setCarrito((prev) => prev.filter((_, i) => i !== index));
  };

  const totalPedido = carrito.reduce(
    (acc, item) => acc + (item.subtotal_linea || 0),
    0,
  );

  return {
    carrito,
    setCarrito,
    errorStock,
    setErrorStock,
    agregarAlCarrito,
    modificarCantidad,
    actualizarCantidadInput,
    cambiarTipoPrecio,
    eliminarDelCarrito,
    totalPedido,
  };
}
