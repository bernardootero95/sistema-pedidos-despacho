import { useState } from "react";
import { Building2 } from "lucide-react";
import { tenantConfig } from "../../config/tenant";

/**
 * Logo de la empresa configurado en VITE_COMPANY_LOGO (login, menú). Si no
 * hay logo o no carga (URL mal escrita, URL firmada vencida), muestra el
 * ícono genérico en vez de una imagen rota.
 */
export const TenantLogo = ({ className = "", iconClassName = "w-6 h-6" }) => {
  const [fallo, setFallo] = useState(false);

  if (!tenantConfig.logoUrl || fallo) {
    return <Building2 className={iconClassName} aria-hidden="true" />;
  }

  return (
    <img
      src={tenantConfig.logoUrl}
      alt={`Logo de ${tenantConfig.name}`}
      onError={() => setFallo(true)}
      className={`object-contain ${className}`}
    />
  );
};
