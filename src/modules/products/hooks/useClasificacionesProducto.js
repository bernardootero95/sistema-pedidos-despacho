import { useEffect, useState } from "react";
import { productService } from "../services/productService";

const VACIAS = { tipos: [], departamentos: [], lineas: [], categorias: [] };

/**
 * Carga una vez los valores ya usados de tipo, departamento, línea y
 * categoría para los selectores del formulario de producto. Si la carga falla
 * no bloquea nada: los campos siguen funcionando para escribir un valor
 * nuevo, solo sin lista de sugerencias.
 */
export const useClasificacionesProducto = () => {
  const [clasificaciones, setClasificaciones] = useState(VACIAS);

  useEffect(() => {
    productService
      .getClasificaciones()
      .then(setClasificaciones)
      .catch(() => {});
  }, []);

  return { clasificaciones };
};
