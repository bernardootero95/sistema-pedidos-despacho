import { FeatureToggleCard } from "../components/FeatureToggleCard";
import { PaymentMethodsSection } from "../components/PaymentMethodsSection";
import { RolesPermisoSelector } from "../components/RolesPermisoSelector";
import { ROLES_CREDITO, ROLES_PRECIO_MANUAL } from "../utils/permisosRoles";
import { useGuardarOpcion } from "../hooks/useGuardarOpcion";
import { CreditCard, Wallet, ShoppingBag, Receipt, PencilLine } from "lucide-react";

const OPCIONES = [
  {
    campo: "metodosPagoActivo",
    icon: CreditCard,
    titulo: "Métodos de pago",
    descripcion:
      "Pide el método de pago (efectivo, transferencia, etc.) al cobrar un pedido o pagar una compra, y permite dividir un pago entre varios métodos. Apagado, todo se registra en efectivo.",
  },
  {
    campo: "abonosPedidosActivo",
    icon: Wallet,
    titulo: "Abonos a pedidos",
    descripcion:
      "Permite registrar abonos a pedidos pendientes. Al pasar el pedido a entregado se cobra el resto.",
  },
  {
    campo: "abonosComprasActivo",
    icon: ShoppingBag,
    titulo: "Abonos a compras",
    descripcion:
      "Permite registrar una compra con pago parcial y abonar al proveedor después. Apagado, toda compra se paga completa al registrarla.",
  },
  {
    campo: "facturacionAutomaticaActivo",
    icon: Receipt,
    titulo: "Facturación electrónica automática",
    descripcion:
      "Emite la factura electrónica ante la DIAN (IngeFact) en cuanto un pedido queda entregado. Si un pedido facturado se anula, se devuelve o se revierte su entrega, la factura se anula con una nota crédito, esté o no encendida esta opción.",
  },
  {
    campo: "precioManualActivo",
    icon: PencilLine,
    titulo: "Cambiar el precio al vender",
    descripcion:
      "Permite cambiar a mano el precio unitario de un producto al tomar o editar un pedido. Tú eliges abajo qué perfiles pueden hacerlo. Un precio ya cambiado se conserva aunque apagues esta opción.",
  },
];

export const SettingsPage = () => {
  const { settings, guardando, guardarOpcion } = useGuardarOpcion();
  // El crédito necesita métodos de pago (para elegirlo) y abonos (para cobrar
  // después el saldo): sin ambos no hay nada que autorizar.
  const mostrarCredito = settings.metodosPagoActivo && settings.abonosPedidosActivo;

  return (
    <div className="space-y-6 relative">
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary shrink-0" />
          <span>Pagos y Facturación</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Métodos de pago, abonos y facturación electrónica según cómo cobra tu empresa.
        </p>
      </div>

      <div className="space-y-3">
        {OPCIONES.map(({ campo, ...opcion }) => (
          <FeatureToggleCard
            key={campo}
            {...opcion}
            activo={settings[campo]}
            guardando={guardando === campo}
            onToggle={() => guardarOpcion(campo, !settings[campo])}
          />
        ))}
      </div>

      {(settings.precioManualActivo || mostrarCredito) && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Permisos por perfil</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Aquí se define qué perfiles pueden usar cada función. Soporte y
              gerencia siempre tienen todos los permisos.
            </p>
          </div>

          {settings.precioManualActivo && (
            <RolesPermisoSelector
              titulo="Cambiar el precio al vender"
              descripcion="Solo estos perfiles verán el lápiz junto al precio al tomar o editar un pedido."
              catalogo={ROLES_PRECIO_MANUAL}
              roles={settings.precioManualRoles}
              guardando={guardando === "precioManualRoles"}
              onChange={(roles) => guardarOpcion("precioManualRoles", roles)}
            />
          )}

          {mostrarCredito && (
            <RolesPermisoSelector
              titulo="Entregar pedidos a crédito"
              descripcion="Solo estos perfiles verán el método «Crédito» al cobrar una entrega: lo que quede a crédito es saldo por cobrar con abonos."
              catalogo={ROLES_CREDITO}
              roles={settings.creditoRoles}
              guardando={guardando === "creditoRoles"}
              onChange={(roles) => guardarOpcion("creditoRoles", roles)}
            />
          )}
        </section>
      )}

      {settings.metodosPagoActivo && <PaymentMethodsSection />}
    </div>
  );
};
