import { useState, useEffect } from "react";
import { productService } from "../services/productService";
import { priceTypeService } from "../../priceTypes/services/priceTypeService";
import { validatePrecioPersonalizado } from "../utils/productValidations";

/**
 * Estado de los precios diferenciados (frío, crédito, etc.) de un producto
 * dentro de un formulario: carga los tipos de precio activos del catálogo y,
 * si el producto ya existe, el valor que tiene en cada uno. Compartido entre
 * ProductForm y ProductPriceForm para no duplicar esta lógica dos veces.
 *
 * Los valores viven como strings (los de un <input>) indexados por
 * tipo_precio_id; un valor vacío significa "este producto no tiene ese
 * precio".
 */
export function usePreciosPersonalizados(productoId = null) {
  const [tiposPrecio, setTiposPrecio] = useState([]);
  const [valores, setValores] = useState({});
  const [errores, setErrores] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelado = false;

    Promise.all([
      priceTypeService.getTiposPrecio({ soloActivos: true }),
      productoId
        ? productService.getPreciosPersonalizados(productoId)
        : Promise.resolve([]),
    ])
      .then(([tipos, precios]) => {
        if (cancelado) return;
        setTiposPrecio(tipos);
        setValores(
          Object.fromEntries(
            precios.map((p) => [p.tipo_precio_id, String(p.precio)]),
          ),
        );
      })
      .catch((error) => {
        if (!cancelado) setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [productoId]);

  const cambiarValor = (tipoId, value) => {
    setValores((prev) => ({ ...prev, [tipoId]: value }));
    if (touched[tipoId]) {
      setErrores((prev) => ({
        ...prev,
        [tipoId]: validatePrecioPersonalizado(value),
      }));
    }
  };

  const tocarValor = (tipoId) => {
    setTouched((prev) => ({ ...prev, [tipoId]: true }));
    setErrores((prev) => ({
      ...prev,
      [tipoId]: validatePrecioPersonalizado(valores[tipoId]),
    }));
  };

  /** Valida todos los tipos antes de enviar. Devuelve true si no hay errores. */
  const validar = () => {
    const nuevosErrores = {};
    const nuevosTouched = {};
    tiposPrecio.forEach((tipo) => {
      nuevosTouched[tipo.id] = true;
      const error = validatePrecioPersonalizado(valores[tipo.id]);
      if (error) nuevosErrores[tipo.id] = error;
    });
    setTouched(nuevosTouched);
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const guardar = (productoIdGuardado) => {
    const precios = tiposPrecio
      .filter((tipo) => (valores[tipo.id] ?? "") !== "")
      .map((tipo) => ({
        tipo_precio_id: tipo.id,
        precio: parseFloat(valores[tipo.id]),
      }));

    return productService.reemplazarPreciosPersonalizados(
      productoIdGuardado,
      tiposPrecio.map((tipo) => tipo.id),
      precios,
    );
  };

  return {
    tiposPrecio,
    valores,
    errores,
    loading,
    loadError,
    cambiarValor,
    tocarValor,
    validar,
    guardar,
  };
}
