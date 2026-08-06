import React from "react";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4 flex flex-col md:flex-row justify-between items-center gap-2">
          {/* Derechos de Autor y Empresa Desarrolladora */}
          <div className="text-sm text-slate-500">
            &copy; {currentYear} Desarrollado por{" "}
            <a
              href="https://tecnoingenieriabo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-700 hover:text-primary transition-colors"
            >
              TecnoIngeniería B.O.
            </a>{" "}
            Todos los derechos reservados.
          </div>

          {/* Versión del Sistema y Enlace de Soporte */}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>Versión 1.0.0</span>
            <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300"></span>
            <a
              href="https://tecnoingenieriabo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              Soporte Técnico
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
