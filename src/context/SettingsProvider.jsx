import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./useAuth";
import { SettingsContext } from "./SettingsContext";
import { settingsService } from "../modules/settings/services/settingsService";
import { paymentMethodService } from "../modules/settings/services/paymentMethodService";

const CONFIG_INICIAL = {
  metodosPagoActivo: false,
  abonosPedidosActivo: false,
  abonosComprasActivo: false,
  facturacionAutomaticaActivo: false,
  impresionCartaActivo: false,
  imprimirLogoActivo: false,
};

/**
 * Expone a toda la app los interruptores funcionales de la empresa (métodos
 * de pago, abonos a pedidos, abonos a compras) y los métodos de pago activos.
 *
 * Es solo para decidir qué mostrar: la fuente de verdad de cada regla es el
 * servidor (las RPC leen configuracion_sistema), así que si esta copia queda
 * desactualizada el servidor igual rechaza la operación con un mensaje claro.
 * Sin sesión, mientras carga o si falla, todo se asume apagado, que equivale
 * al comportamiento sin la funcionalidad.
 */
export const SettingsProvider = ({ children }) => {
  const { user } = useAuth();
  const [config, setConfig] = useState(CONFIG_INICIAL);
  const [metodosPago, setMetodosPago] = useState([]);

  // Devuelve la promesa para que quien guarda un cambio pueda esperar a que
  // la copia local quede al día.
  const recargar = useCallback(
    () =>
      Promise.all([
        settingsService.getConfiguracion(),
        paymentMethodService.getMetodosPago({ soloActivos: true }),
      ])
        .then(([configuracion, metodos]) => {
          setConfig(configuracion);
          setMetodosPago(metodos);
        })
        .catch((error) => {
          console.error("No se pudo cargar la configuración:", error);
        }),
    [],
  );

  const hayUsuario = !!user;
  useEffect(() => {
    if (hayUsuario) recargar();
  }, [hayUsuario, recargar]);

  const value = useMemo(
    () => ({
      ...(hayUsuario ? config : CONFIG_INICIAL),
      metodosPago: hayUsuario ? metodosPago : [],
      recargar,
    }),
    [hayUsuario, config, metodosPago, recargar],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
