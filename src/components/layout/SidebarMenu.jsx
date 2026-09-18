import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";

const claseEnlace = (isActive) =>
  `flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg text-sm font-medium transition-all ${
    isActive
      ? "bg-primary text-white shadow-md shadow-primary/20 font-bold"
      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
  }`;

const MenuLink = ({ item, onNavigate }) => {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) => claseEnlace(isActive)}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
};

const estaActivo = (pathname, path) =>
  pathname === path || pathname.startsWith(`${path}/`);

/**
 * Grupo desplegable del menú. Arranca abierto si la ruta actual pertenece a
 * uno de sus hijos; después manda lo que el usuario abra o cierre a mano.
 */
const MenuGroup = ({ group, onNavigate }) => {
  const { pathname } = useLocation();
  const [abiertoManual, setAbiertoManual] = useState(null);
  const Icon = group.icon;

  const tieneHijoActivo = group.children.some((hijo) =>
    estaActivo(pathname, hijo.path),
  );
  const abierto = abiertoManual ?? tieneHijoActivo;
  const panelId = `menu-grupo-${group.key}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setAbiertoManual(!abierto)}
        aria-expanded={abierto}
        aria-controls={panelId}
        className={`w-full flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg text-sm font-medium transition-all ${
          tieneHijoActivo
            ? "text-white"
            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        }`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span className="flex-1 text-left truncate">{group.label}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <div
          id={panelId}
          className="mt-1 ml-5 pl-3 border-l border-slate-800 space-y-1"
        >
          {group.children.map((hijo) => (
            <MenuLink key={hijo.path} item={hijo} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Lista de navegación del sidebar: enlaces sueltos y grupos desplegables.
 * Componente de presentación: recibe el menú ya filtrado por rol.
 */
export const SidebarMenu = ({ items, onNavigate }) => (
  <>
    {items.map((item) =>
      item.children ? (
        <MenuGroup key={item.key} group={item} onNavigate={onNavigate} />
      ) : (
        <MenuLink key={item.path} item={item} onNavigate={onNavigate} />
      ),
    )}
  </>
);
