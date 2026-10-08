import { useCallback, useEffect, useMemo, useState } from "react";
import { physicalCountService } from "../services/physicalCountService";
import { parseCantidadContada, resumirToma } from "../utils/physicalCountCalc";
import { validatePhysicalCountEntries, validatePhysicalCountField } from "../utils/physicalCountValidations";

/**
 * Estado y acciones de una toma física: carga, conteo digitado (sin guardar),
 * guardado por lote, aplicación y cancelación. La fuente de verdad del conteo
 * es `lineas[].cantidadContada` (lo guardado) más `digitados` (lo editado sin
 * guardar); el conteo vigente de cada producto se deriva de ambos.
 */
export const usePhysicalCount = (tomaId) => {
  const [toma, setToma] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [digitados, setDigitados] = useState({}); // productoId → texto
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    const [cabecera, detalle] = await Promise.all([
      physicalCountService.getToma(tomaId),
      physicalCountService.getLineas(tomaId),
    ]);
    setToma(cabecera);
    setLineas(detalle);
    setDigitados({});
    setErrors({});
  }, [tomaId]);

  // queueMicrotask evita el warning de ESLint por setState sincrónico dentro
  // del efecto (mismo fix que usePaginatedList).
  useEffect(() => {
    queueMicrotask(() => {
      cargar()
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    });
  }, [cargar]);

  const editable = toma?.estado === "borrador";

  // Conteo vigente por producto: lo digitado (si es válido) o lo guardado.
  const contados = useMemo(() => {
    const mapa = {};
    lineas.forEach((l) => {
      const texto = digitados[l.productoId];
      if (texto === undefined) {
        mapa[l.productoId] = l.cantidadContada;
        return;
      }
      const cantidad = parseCantidadContada(texto);
      mapa[l.productoId] = Number.isNaN(cantidad) ? l.cantidadContada : cantidad;
    });
    return mapa;
  }, [lineas, digitados]);

  const resumen = useMemo(() => resumirToma(lineas, contados), [lineas, contados]);

  // Cambios pendientes de guardar: lo digitado que difiere de lo guardado.
  const pendientes = useMemo(() => {
    const porProducto = new Map(lineas.map((l) => [l.productoId, l]));
    return Object.entries(digitados)
      .map(([productoId, texto]) => ({ productoId, cantidadContada: parseCantidadContada(texto) }))
      .filter(({ productoId, cantidadContada }) => {
        const guardado = porProducto.get(productoId)?.cantidadContada ?? null;
        return !Number.isNaN(cantidadContada) && cantidadContada !== guardado;
      });
  }, [lineas, digitados]);

  const digitar = (productoId, texto) => {
    setDigitados((prev) => ({ ...prev, [productoId]: texto }));
    // Validación inmediata solo si ya había error mostrado o el texto es inválido.
    setErrors((prev) => {
      const mensaje = validatePhysicalCountField("contado", texto);
      if (!mensaje && !prev[productoId]) return prev;
      return { ...prev, [productoId]: mensaje };
    });
  };

  const validarCampo = (productoId, texto) => {
    setErrors((prev) => ({ ...prev, [productoId]: validatePhysicalCountField("contado", texto) }));
  };

  /** Carga a la pantalla los conteos importados (sin guardarlos todavía). */
  const aplicarImportados = (conteos) => {
    setDigitados((prev) => {
      const siguiente = { ...prev };
      conteos.forEach((cantidad, productoId) => {
        siguiente[productoId] = String(cantidad);
      });
      return siguiente;
    });
  };

  /** Guarda lo digitado; devuelve false si hay errores de validación. */
  const guardar = async () => {
    const formErrors = validatePhysicalCountEntries(digitados);
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) {
      throw new Error("Corrige los conteos marcados en rojo antes de guardar.");
    }
    if (pendientes.length === 0) return 0;

    setTrabajando(true);
    try {
      await physicalCountService.guardarConteos(tomaId, pendientes);
      await cargar();
      return pendientes.length;
    } finally {
      setTrabajando(false);
    }
  };

  /** Guarda lo pendiente y aplica la toma; recarga porque el stock cambió. */
  const aplicar = async () => {
    await guardar();
    setTrabajando(true);
    try {
      const resultado = await physicalCountService.aplicarToma(tomaId);
      await cargar();
      return resultado;
    } finally {
      setTrabajando(false);
    }
  };

  const cancelar = async () => {
    setTrabajando(true);
    try {
      await physicalCountService.cancelarToma(tomaId);
      await cargar();
    } finally {
      setTrabajando(false);
    }
  };

  return {
    toma,
    lineas,
    digitados,
    contados,
    resumen,
    pendientes,
    errors,
    loading,
    error,
    trabajando,
    editable,
    digitar,
    validarCampo,
    aplicarImportados,
    guardar,
    aplicar,
    cancelar,
  };
};
