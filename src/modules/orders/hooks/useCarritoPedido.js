import { useState } from "react";
import {
  validarStockParaAgregar,
  validarStockParaCantidad,
  redondearACantidadValida,
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

  // Si alguna franja califica por cantidad, se usa la de mayor umbral (el
  // mejor descuento que se alcanza). Si ninguna califica y aun así se
  // fuerza mayorista, se usa la franja de entrada (menor cantidad_minima)
  // — el descuento más conservador, no el más profundo — mismo criterio
  // que resolver_precio_pedido en el servidor.
  if (calificantes.length > 0) {
    return calificantes.reduce((mayor, t) =>
      t.cantidad_minima > mayor.cantidad_minima ? t : mayor,
    ).precio;
  }
  return tiersMayoristas.reduce((entrada, t) =>
    t.cantidad_minima < entrada.cantidad_minima ? t : entrada,
  ).precio;
};

/**
 * Recalcula tipo_precio + precio_unitario de una línea al cambiar su
 * cantidad. Frío y crédito nunca dependen de la cantidad, así que una vez
 * activados se mantienen tal cual. El mayorista sí: se activa SOLO por
 * cantidad — "se calcula según la cantidad" — sin que quien arma el
 * pedido tenga que activarlo a mano; si ya estaba forzado manualmente
 * (cambiarTipoPrecio) y la cantidad baja del umbral, se mantiene forzado
 * en la franja más económica en vez de perder el forzado silenciosamente.
 */
const resolverLineaParaCantidad = (item, cantidad) => {
  if (item.tipo_precio === "frio" || item.tipo_precio === "credito") {
    return { tipo_precio: item.tipo_precio, precio_unitario: item.precio_unitario };
  }

  const yaEstabaEnMayorista = item.tipo_precio === "mayorista";
  const calificaPorCantidad = (item.tiersMayoristas || []).some(
    (t) => t.cantidad_minima <= cantidad,
  );

  if (
    (calificaPorCantidad || yaEstabaEnMayorista) &&
    item.tiersMayoristas?.length > 0
  ) {
    return {
      tipo_precio: "mayorista",
      precio_unitario: resolverPrecioMayoristaPreview(
        item.tiersMayoristas,
        cantidad,
      ),
    };
  }

  return { tipo_precio: "normal", precio_unitario: item.precio_venta };
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
        const { tipo_precio, precio_unitario } = resolverLineaParaCantidad(
          item,
          cantidad,
        );
        nuevo[existeIndex] = {
          ...item,
          cantidad,
          tipo_precio,
          precio_unitario,
          subtotal_linea: cantidad * precio_unitario,
        };
        return nuevo;
      });
    } else {
      const itemNuevo = {
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
        precio_credito: producto.precio_credito ?? null,
        tiersMayoristas: producto.tiersMayoristas || [],
      };
      const { tipo_precio, precio_unitario } = resolverLineaParaCantidad(
        itemNuevo,
        1,
      );
      setCarrito((prev) => [
        ...prev,
        {
          ...itemNuevo,
          tipo_precio,
          precio_unitario,
          subtotal_linea: precio_unitario,
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
      const { tipo_precio, precio_unitario } = resolverLineaParaCantidad(
        item,
        nuevaCantidad,
      );
      nuevo[index] = {
        ...item,
        cantidad: nuevaCantidad,
        tipo_precio,
        precio_unitario,
        subtotal_linea: nuevaCantidad * precio_unitario,
      };
      return nuevo;
    });
    setErrorStock("");
  };

  const actualizarCantidadInput = (index, valorTexto) => {
    // Acepta decimales (media caja, etc.): se admite "," como separador
    // además de "." porque el input es type="number" con locale variable.
    const texto = valorTexto.toString().trim().replace(",", ".");
    const cantidadEscrita = texto === "" ? 1 : Number(texto);
    if (Number.isNaN(cantidadEscrita)) return;

    // Solo se manejan cuartos de unidad: lo que se escriba se ajusta al
    // múltiplo de .25 más cercano (ej. "1.3" -> 1.25).
    const cantidad = redondearACantidadValida(cantidadEscrita);
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
      const { tipo_precio, precio_unitario } = resolverLineaParaCantidad(
        item,
        cantidadFinal,
      );
      nuevo[index] = {
        ...item,
        cantidad: cantidadFinal,
        tipo_precio,
        precio_unitario,
        subtotal_linea: cantidadFinal * precio_unitario,
      };
      return nuevo;
    });
  };

  /**
   * Cambia el tipo de precio (normal/mayorista/frio/credito) de una línea
   * ya agregada. El precio mostrado es solo un preview local — el
   * servidor lo recalcula de todas formas al guardar (ver
   * resolver_precio_pedido).
   */
  const cambiarTipoPrecio = (index, tipoPrecio) => {
    setCarrito((prev) => {
      const nuevo = [...prev];
      const item = nuevo[index];
      let precio_unitario = item.precio_venta;

      if (tipoPrecio === "frio" && item.precio_frio != null) {
        precio_unitario = item.precio_frio;
      } else if (tipoPrecio === "credito" && item.precio_credito != null) {
        precio_unitario = item.precio_credito;
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
