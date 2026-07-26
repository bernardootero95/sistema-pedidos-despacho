/**
 * Configuración de la empresa actual inyectada mediante Variables de Entorno.
 * Sigue el Principio de Responsabilidad Única (SRP) centralizando la información visual.
 */
export const tenantConfig = {
  name: import.meta.env.VITE_COMPANY_NAME || "Sistema de Pedidos y Despacho",
  logoUrl: import.meta.env.VITE_COMPANY_LOGO || "/vite.svg",
  colors: {
    primary: import.meta.env.VITE_COLOR_PRIMARY || "#2563eb",
    primaryHover: import.meta.env.VITE_COLOR_PRIMARY_HOVER || "#1d4ed8",
    primaryLight: import.meta.env.VITE_COLOR_PRIMARY_LIGHT || "#dbeafe",
    secondary: import.meta.env.VITE_COLOR_SECONDARY || "#475569",
    secondaryHover: import.meta.env.VITE_COLOR_SECONDARY_HOVER || "#334155",
  },
};

/**
 * Aplica las variables de entorno de color al CSS nativo (Tailwind v4) al montar la app.
 */
export const applyTenantTheme = () => {
  const root = document.documentElement;
  const { colors } = tenantConfig;

  if (colors.primary) root.style.setProperty("--color-primary", colors.primary);
  if (colors.primaryHover)
    root.style.setProperty("--color-primary-hover", colors.primaryHover);
  if (colors.primaryLight)
    root.style.setProperty("--color-primary-light", colors.primaryLight);
  if (colors.secondary)
    root.style.setProperty("--color-secondary", colors.secondary);
  if (colors.secondaryHover)
    root.style.setProperty("--color-secondary-hover", colors.secondaryHover);

  // Actualiza el título de la pestaña del navegador con el nombre de la empresa
  document.title = tenantConfig.name;
};
