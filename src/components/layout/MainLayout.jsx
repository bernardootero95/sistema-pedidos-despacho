import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { tenantConfig } from "../../config/tenant";
import { ROLES_MODULO } from "../../config/roles";
import { Footer } from "./Footer"; // <-- Asegúrate de ajustar esta ruta donde hayas guardado Footer.jsx
import { ProfileMenu } from "./ProfileMenu";
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
  UserCog,
  MapPin,
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
      roles: ROLES_MODULO.DASHBOARD,
    },
    {
      path: "/usuarios",
      label: "Gestión de Personal",
      icon: UserCog,
      roles: ROLES_MODULO.USUARIOS,
    },
    {
      path: "/pedidos",
      label: "Toma de Pedidos",
      icon: ShoppingCart,
      roles: ROLES_MODULO.PEDIDOS,
    },
    {
      path: "/despachos",
      label: "Órdenes de Despacho",
      icon: Truck,
      roles: ROLES_MODULO.DESPACHOS,
    },
    {
      path: "/despachos/mi-ruta",
      label: "Mi Ruta de Hoy",
      icon: MapPin,
      roles: ROLES_MODULO.MI_RUTA,
    },
    {
      path: "/clientes",
      label: "Clientes",
      icon: Users,
      roles: ROLES_MODULO.CLIENTES,
    },
    {
      path: "/productos",
      label: "Catálogo de Productos",
      icon: Package,
      roles: ROLES_MODULO.PRODUCTOS,
    },
    {
      path: "/vehiculos",
      label: "Flota de Vehículos",
      icon: Truck,
      roles: ROLES_MODULO.VEHICULOS,
    },
  ];

  const visibleMenuItems = menuItems.filter(
    (item) => user && item.roles.includes(user.rol),
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Overlay Móvil */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"}
      `}
      >
        <div className="p-4 flex items-center justify-between bg-slate-950/50 border-b border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-primary/20 text-primary rounded-lg shrink-0">
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
                <Icon className="w-5 h-5 shrink-0" />
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
            className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Superior */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-sm shrink-0 z-10">
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
            <ProfileMenu />
          </div>
        </header>

        {/* Área de scroll principal modificada para incluir el Footer */}
        <main className="flex-1 overflow-y-auto bg-slate-50 flex flex-col">
          {/* El contenido de las páginas ocupa el espacio flexible */}
          <div className="p-4 sm:p-6 flex-1">
            <Outlet />
          </div>

          {/* Inyección del Footer al final del scroll */}
        </main>
        <div className="shrink-0 z-10">
          <Footer />
        </div>
      </div>
    </div>
  );
};
