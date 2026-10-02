import { CompanyDataSection } from "../components/CompanyDataSection";
import { PrintSettingsSection } from "../components/PrintSettingsSection";
import { Building2 } from "lucide-react";

/**
 * Datos Empresa: identidad del emisor, logo y cómo se imprimen pedidos y
 * facturas.
 */
export const CompanyPage = () => (
  <div className="space-y-6 relative">
    <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
        <Building2 className="w-6 h-6 text-primary shrink-0" />
        <span>Datos Empresa</span>
      </h1>
      <p className="text-xs sm:text-sm text-slate-500 mt-1">
        Información, logo y formato de impresión de pedidos y facturas.
      </p>
    </div>

    <CompanyDataSection />
    <PrintSettingsSection />
  </div>
);
