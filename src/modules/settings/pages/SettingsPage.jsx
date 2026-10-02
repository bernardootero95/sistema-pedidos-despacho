import { useState } from "react";
import { settingsService } from "../services/settingsService";
import { FeatureToggleCard } from "../components/FeatureToggleCard";
import { PaymentMethodsSection } from "../components/PaymentMethodsSection";
import { CompanyDataSection } from "../components/CompanyDataSection";
import { useSettings } from "../../../context/useSettings";
import { useToast } from "../../../context/useToast";
import {
  SlidersHorizontal,
  CreditCard,
  Wallet,
  ShoppingBag,
  Receipt,
  FileText,
  ImageIcon,
} from "lucide-react";

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
    campo: "impresionCartaActivo",
    icon: FileText,
    titulo: "Impresión en tamaño carta",
    descripcion:
      "Imprime pedidos y facturas electrónicas en hoja carta. Apagado, se imprimen en tirilla POS de 80 mm. Los pedidos con factura electrónica vigente salen siempre como factura, con CUFE y QR.",
  },
  {
    campo: "imprimirLogoActivo",
    icon: ImageIcon,
    titulo: "Imprimir logo",
    descripcion:
      "Incluye el logo de la empresa en pedidos y facturas (tirilla y carta). Si no hay un logo cargado en Datos de la empresa, se imprimen sin logo.",
  },
];

export const SettingsPage = () => {
  const settings = useSettings();
  const { showError, showSuccess } = useToast();
  const [guardando, setGuardando] = useState(null);

  const handleToggle = async (campo) => {
    setGuardando(campo);
    try {
      await settingsService.actualizarInterruptor(campo, !settings[campo]);
      await settings.recargar();
      showSuccess("Opción actualizada.");
    } catch (err) {
      showError(err.message);
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <SlidersHorizontal className="w-6 h-6 text-primary shrink-0" />
          <span>Opciones</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Activa o desactiva funcionalidades según cómo trabaja tu empresa.
        </p>
      </div>

      <div className="space-y-3">
        {OPCIONES.map(({ campo, ...opcion }) => (
          <FeatureToggleCard
            key={campo}
            {...opcion}
            activo={settings[campo]}
            guardando={guardando === campo}
            onToggle={() => handleToggle(campo)}
          />
        ))}
      </div>

      <CompanyDataSection />

      {settings.metodosPagoActivo && <PaymentMethodsSection />}
    </div>
  );
};
