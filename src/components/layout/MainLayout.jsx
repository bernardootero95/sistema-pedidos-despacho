import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { tenantConfig } from "../../config/tenant";
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Users,
  Package,
  LogOut,
  Building2,
  Menu,
  X,
} from "lucide-react";

export const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

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
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

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
              <p className="text-[11px] text-slate-400 truncate">Operaciones</p>
            </div>
          </div>
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
                onClick={() => setIsMobileMenuOpen(false)}
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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* HEADER DE PRODUCCIÓN LIMPIO */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-sm flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menú de navegación"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg md:hidden focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-sm font-bold text-slate-800 hidden sm:block">
              Panel de Control Operativo
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-900">
                {user?.nombre_completo}
              </p>
              <p className="text-[10px] text-slate-500 uppercase">
                {user?.rol}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm">
              {user?.nombre_completo?.charAt(0).toUpperCase() || "U"}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
