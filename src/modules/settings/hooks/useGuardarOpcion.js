import { useState } from "react";
import { settingsService } from "../services/settingsService";
import { useSettings } from "../../../context/useSettings";
import { useToast } from "../../../context/useToast";

/**
 * Guarda una opción de `configuracion_sistema` y refresca la copia del
 * contexto. Compartido por las páginas Pagos y Facturación y Datos Empresa.
 * `guardando` es el campo en curso (o null) para mostrar su spinner.
 */
export const useGuardarOpcion = () => {
  const settings = useSettings();
  const { showError, showSuccess } = useToast();
  const [guardando, setGuardando] = useState(null);

  const guardarOpcion = async (campo, valor) => {
    setGuardando(campo);
    try {
      await settingsService.actualizarInterruptor(campo, valor);
      await settings.recargar();
      showSuccess("Opción actualizada.");
    } catch (err) {
      showError(err.message);
    } finally {
      setGuardando(null);
    }
  };

  return { settings, guardando, guardarOpcion };
};
