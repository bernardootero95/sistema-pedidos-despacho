import { useState } from "react";
import {
  validarStockParaAgregar,
  validarStockParaCantidad,
} from "../utils/orderValidations";

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
        nuevo[existeIndex] = {
          ...item,
          cantidad,
          subtotal_linea: cantidad * item.precio_unitario,
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
      nuevo[index] = {
        ...item,
        cantidad: nuevaCantidad,
        subtotal_linea: nuevaCantidad * item.precio_unitario,
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
      nuevo[index] = {
        ...item,
        cantidad: cantidadFinal,
        subtotal_linea: cantidadFinal * item.precio_unitario,
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
    eliminarDelCarrito,
    totalPedido,
  };
}
