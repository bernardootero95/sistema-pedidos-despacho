import React from "react";
import { tenantConfig } from "../../config/tenant";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4 flex flex-col md:flex-row justify-between items-center gap-2">
          {/* Derechos de Autor y Empresa */}
          <div className="text-sm text-slate-500">
            &copy; {currentYear}{" "}
            <span className="font-semibold text-slate-700">
              {tenantConfig.name}
            </span>
            . Todos los derechos reservados.
          </div>

          {/* Versión del Sistema y Soporte (Opcional) */}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>Versión 1.0.0</span>
            <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300"></span>
            <a href="#" className="hover:text-blue-600 transition-colors">
              Soporte Técnico
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
