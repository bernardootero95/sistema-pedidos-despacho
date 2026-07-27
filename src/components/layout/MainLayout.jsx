import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { tenantConfig } from "../../config/tenant";
import { DEMO_DATA } from "../../mock/demoData";
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Users,
  Package,
  LogOut,
  Building2,
  Shield,
  Menu,
  X,
} from "lucide-react";

export const MainLayout = () => {
  const { user, logout, switchDemoRole } = useAuth();
  const navigate = useNavigate();

  // Estado para controlar el menú lateral en dispositivos móviles
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Configuración de rutas y permisos visibles por rol para la Demo
  const menuItems = [
    {
      path: "/dashboard",
      label: "Panel Principal",
      icon: LayoutDashboard,
      roles: ["soporte", "gerencia", "vendedor", "despachador", "repartidor"],
    },
    {
      path: "/pedidos",
      label: "Toma de Pedidos",
      icon: ShoppingCart,
      roles: ["soporte", "gerencia", "vendedor", "despachador"],
    },
    {
      path: "/despachos",
      label: "Órdenes de Despacho",
      icon: Truck,
      roles: ["soporte", "gerencia", "despachador", "repartidor"],
    },
    {
      path: "/clientes",
      label: "Clientes",
      icon: Users,
      roles: ["soporte", "gerencia", "vendedor"],
    },
    {
      path: "/productos",
      label: "Catálogo de Productos",
      icon: Package,
      roles: ["soporte", "gerencia", "vendedor", "despachador"],
    },
    {
      path: "/vehiculos",
      label: "Flota de Vehículos",
      icon: Truck,
      roles: ["soporte", "gerencia", "despachador"],
    },
  ];

  const visibleMenuItems = menuItems.filter(
    (item) => user && item.roles.includes(user.rol),
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* OVERLAY DE FONDO PARA MÓVILES (Cortina oscura al abrir el menú) */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR RESPONSIVO (Drawer en móviles / Fijo en Escritorio) */}
      <aside
        className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 flex-shrink-0
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"}
      `}
      >
        <div className="p-4 flex items-center justify-between bg-slate-950/50 border-b border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-primary/20 text-primary rounded-lg flex-shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <h1 className="font-bold text-white text-sm truncate">
                {tenantConfig.name}
              </h1>
              <p className="text-[11px] text-slate-400 truncate">
                Marca Blanca • Logística
              </p>
            </div>
          </div>
          {/* Botón para cerrar en móvil */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold uppercase text-slate-500 px-3 mb-2 tracking-wider">
            Módulos del Sistema
          </div>
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)} // Cierra el drawer en celular al navegar
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-white shadow-md shadow-primary/20 font-bold"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* PIE DEL SIDEBAR: USUARIO ACTUAL */}
        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between">
          <div className="overflow-hidden pr-2">
            <p className="text-sm font-bold text-white truncate">
              {user?.nombre_completo}
            </p>
            <span className="inline-block px-2 py-0.5 mt-1 bg-slate-800 text-primary-light text-[10px] font-semibold rounded uppercase tracking-wider">
              {user?.rol}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar Sesión"
            className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* HEADER RESPONSIVO */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-sm flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            {/* Botón de Hamburguesa para Celulares */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menú de navegación"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg md:hidden focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold bg-amber-100 text-amber-800 px-2 py-1 sm:px-2.5 rounded-full uppercase tracking-wide border border-amber-300">
                Demo
              </span>
              <span className="text-xs text-slate-500 hidden lg:inline">
                Los cambios visuales no afectan la base de datos real.
              </span>
            </div>
          </div>

          {/* SELECTOR DE ROLES COMPACTO PARA MÓVILES Y ESCRITORIO */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Shield className="w-4 h-4 text-primary flex-shrink-0" />
              <span>Cambiar vista a:</span>
            </div>
            <select
              value={user?.rol || ""}
              onChange={(e) => switchDemoRole(e.target.value)}
              className="text-xs font-bold bg-slate-100 border border-slate-300 text-slate-800 rounded-lg px-2.5 py-2 sm:px-3 sm:py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer capitalize"
            >
              {DEMO_DATA.usuarios.map((u) => (
                <option key={u.id} value={u.rol}>
                  {u.rol.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* ÁREA DE CONTENIDO DINÁMICO */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
