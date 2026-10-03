import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Users,
  Package,
  UserCog,
  MapPin,
  FileBarChart,
  Handshake,
  ShoppingBag,
  Tag,
  Contact,
  Settings,
  Wallet,
  TrendingUp,
  PackageSearch,
  PiggyBank,
  Building2,
  BookOpen,
} from "lucide-react";
import { ROLES_MODULO } from "../../config/roles";

/**
 * Estructura del menú lateral. Cada entrada es un enlace
 * ({ path, label, icon, roles }) o un grupo desplegable
 * ({ key, label, icon, children }); los grupos no tienen `roles` propios:
 * se muestran si el rol actual ve al menos uno de sus hijos.
 */
export const MENU_ITEMS = [
  {
    path: "/dashboard",
    label: "Panel Principal",
    icon: LayoutDashboard,
    roles: ROLES_MODULO.DASHBOARD,
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
    path: "/productos",
    label: "Catálogo de Productos",
    icon: Package,
    roles: ROLES_MODULO.PRODUCTOS,
  },
  {
    path: "/compras",
    label: "Compras",
    icon: ShoppingBag,
    roles: ROLES_MODULO.COMPRAS,
  },
  {
    key: "terceros",
    label: "Terceros",
    icon: Contact,
    children: [
      {
        path: "/clientes",
        label: "Clientes",
        icon: Users,
        roles: ROLES_MODULO.CLIENTES,
      },
      {
        path: "/proveedores",
        label: "Proveedores",
        icon: Handshake,
        roles: ROLES_MODULO.PROVEEDORES,
      },
    ],
  },
  {
    key: "informes",
    label: "Informes",
    icon: FileBarChart,
    children: [
      {
        path: "/informes/ventas",
        label: "Ventas y Cierre",
        icon: TrendingUp,
        roles: ROLES_MODULO.INFORMES,
      },
      {
        path: "/informes/utilidad",
        label: "Utilidad del Mes",
        icon: PiggyBank,
        roles: ROLES_MODULO.INFORMES,
      },
      {
        path: "/informes/productos",
        label: "Productos por Pedido",
        icon: PackageSearch,
        roles: ROLES_MODULO.INFORMES,
      },
    ],
  },
  {
    key: "configuracion",
    label: "Configuración",
    icon: Settings,
    children: [
      {
        path: "/datos-empresa",
        label: "Datos Empresa",
        icon: Building2,
        roles: ROLES_MODULO.DATOS_EMPRESA,
      },
      {
        path: "/usuarios",
        label: "Gestión de Personal",
        icon: UserCog,
        roles: ROLES_MODULO.USUARIOS,
      },
      {
        path: "/vehiculos",
        label: "Flota de Vehículos",
        icon: Truck,
        roles: ROLES_MODULO.VEHICULOS,
      },
      {
        path: "/tipos-precio",
        label: "Tipos de Precio",
        icon: Tag,
        roles: ROLES_MODULO.TIPOS_PRECIO,
      },
      {
        path: "/opciones",
        label: "Pagos y Facturación",
        icon: Wallet,
        roles: ROLES_MODULO.OPCIONES,
      },
    ],
  },
  {
    path: "/ayuda",
    label: "Instructivo",
    icon: BookOpen,
    roles: ROLES_MODULO.AYUDA,
  },
];

/**
 * Filtra el menú según el rol: quita los enlaces que el rol no ve, y de los
 * grupos deja solo los hijos visibles (un grupo sin hijos visibles se omite).
 */
export const getMenuVisible = (items, rol) => {
  if (!rol) return [];

  return items.flatMap((item) => {
    if (item.children) {
      const children = item.children.filter((hijo) => hijo.roles.includes(rol));
      return children.length > 0 ? [{ ...item, children }] : [];
    }
    return item.roles.includes(rol) ? [item] : [];
  });
};
