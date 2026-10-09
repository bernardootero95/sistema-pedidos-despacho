import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { LoginPage } from "../modules/auth/pages/LoginPage";
import { MainLayout } from "../components/layout/MainLayout";
import { RoleGuard } from "./RoleGuard";
import { ROLES_MODULO } from "../config/roles";
import { lazyPagina } from "../config/lazyPagina";
import { Loader2 } from "lucide-react";

// Carga perezosa (Lazy Loading) de las páginas
const DashboardPage = lazyPagina(() =>
  import("../modules/dashboard/pages/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const UsersPage = lazyPagina(() =>
  import("../modules/users/pages/UsersPage").then((m) => ({
    default: m.UsersPage,
  })),
);
const ClientsPage = lazyPagina(() =>
  import("../modules/clients/pages/ClientsPage").then((m) => ({
    default: m.ClientsPage,
  })),
);
const ProductsPage = lazyPagina(() =>
  import("../modules/products/pages/ProductsPage").then((m) => ({
    default: m.ProductsPage,
  })),
);
const VehiclesPage = lazyPagina(() =>
  import("../modules/vehicles/pages/VehiclesPage").then((m) => ({
    default: m.VehiclesPage,
  })),
);
// Importación del nuevo formulario de vehículos
const VehicleFormPage = lazyPagina(() =>
  import("../modules/vehicles/pages/VehicleFormPage").then((m) => ({
    default: m.VehicleFormPage,
  })),
);
const OrdersPage = lazyPagina(() =>
  import("../modules/orders/pages/OrdersPage").then((m) => ({
    default: m.OrdersPage,
  })),
);
const OrderCreatePage = lazyPagina(() =>
  import("../modules/orders/pages/OrderCreatePage").then((m) => ({
    default: m.OrderCreatePage,
  })),
);
const OrderDetailsPage = lazyPagina(() =>
  import("../modules/orders/pages/OrderDetailsPage").then((m) => ({
    default: m.OrderDetailsPage,
  })),
);
const OrderEditPage = lazyPagina(() =>
  import("../modules/orders/pages/OrderEditPage").then((m) => ({
    default: m.OrderEditPage,
  })),
);
const QuotesPage = lazyPagina(() =>
  import("../modules/quotes/pages/QuotesPage").then((m) => ({
    default: m.QuotesPage,
  })),
);
const QuoteCreatePage = lazyPagina(() =>
  import("../modules/quotes/pages/QuoteCreatePage").then((m) => ({
    default: m.QuoteCreatePage,
  })),
);
const QuoteDetailsPage = lazyPagina(() =>
  import("../modules/quotes/pages/QuoteDetailsPage").then((m) => ({
    default: m.QuoteDetailsPage,
  })),
);
const DispatchesPage = lazyPagina(() =>
  import("../modules/dispatches/pages/DispatchesPage").then((m) => ({
    default: m.DispatchesPage,
  })),
);
const DispatchCreatePage = lazyPagina(() =>
  import("../modules/dispatches/pages/DispatchCreatePage").then((m) => ({
    default: m.DispatchCreatePage,
  })),
);
const DispatchDetailsPage = lazyPagina(() =>
  import("../modules/dispatches/pages/DispatchDetailsPage").then((m) => ({
    default: m.DispatchDetailsPage,
  })),
);
const RepartidorRoutePage = lazyPagina(() =>
  import("../modules/dispatches/pages/RepartidorRoutePage").then((m) => ({
    default: m.RepartidorRoutePage,
  })),
);
const ResetPasswordPage = lazyPagina(() =>
  import("../modules/auth/pages/ResetPasswordPage").then((m) => ({
    default: m.ResetPasswordPage,
  })),
);
const SalesReportPage = lazyPagina(() =>
  import("../modules/reports/pages/SalesReportPage").then((m) => ({
    default: m.SalesReportPage,
  })),
);
const ProfitReportPage = lazyPagina(() =>
  import("../modules/reports/pages/ProfitReportPage").then((m) => ({
    default: m.ProfitReportPage,
  })),
);
const ProductsReportPage = lazyPagina(() =>
  import("../modules/reports/pages/ProductsReportPage").then((m) => ({
    default: m.ProductsReportPage,
  })),
);
const InventoryReportPage = lazyPagina(() =>
  import("../modules/reports/pages/InventoryReportPage").then((m) => ({
    default: m.InventoryReportPage,
  })),
);
const WarehouseInventoryPage = lazyPagina(() =>
  import("../modules/reports/pages/WarehouseInventoryPage").then((m) => ({
    default: m.WarehouseInventoryPage,
  })),
);
const PhysicalCountsPage = lazyPagina(() =>
  import("../modules/inventory/pages/PhysicalCountsPage").then((m) => ({
    default: m.PhysicalCountsPage,
  })),
);
const PhysicalCountPage = lazyPagina(() =>
  import("../modules/inventory/pages/PhysicalCountPage").then((m) => ({
    default: m.PhysicalCountPage,
  })),
);
const PriceTypesPage = lazyPagina(() =>
  import("../modules/priceTypes/pages/PriceTypesPage").then((m) => ({
    default: m.PriceTypesPage,
  })),
);
const SettingsPage = lazyPagina(() =>
  import("../modules/settings/pages/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  })),
);
const CompanyPage = lazyPagina(() =>
  import("../modules/settings/pages/CompanyPage").then((m) => ({
    default: m.CompanyPage,
  })),
);
const SuppliersPage = lazyPagina(() =>
  import("../modules/suppliers/pages/SuppliersPage").then((m) => ({
    default: m.SuppliersPage,
  })),
);
const PurchasesPage = lazyPagina(() =>
  import("../modules/purchases/pages/PurchasesPage").then((m) => ({
    default: m.PurchasesPage,
  })),
);
const PurchaseCreatePage = lazyPagina(() =>
  import("../modules/purchases/pages/PurchaseCreatePage").then((m) => ({
    default: m.PurchaseCreatePage,
  })),
);
const PurchaseDetailsPage = lazyPagina(() =>
  import("../modules/purchases/pages/PurchaseDetailsPage").then((m) => ({
    default: m.PurchaseDetailsPage,
  })),
);

const HelpPage = lazyPagina(() =>
  import("../modules/help/pages/HelpPage").then((m) => ({
    default: m.HelpPage,
  })),
);

// Componente visual mientras carga el chunk del módulo
const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-sm font-medium text-slate-500">Cargando módulo...</p>
    </div>
  </div>
);

export const AppRouter = () => {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Rutas públicas */}
          <Route
            path="/login"
            element={
              !user ? <LoginPage /> : <Navigate to="/dashboard" replace />
            }
          />
          {/* Sin guard por `user` a propósito: llega desde el enlace del
              correo de recuperación con una sesión temporal propia, que
              ResetPasswordPage valida por su cuenta (ver sessionValida). */}
          <Route path="/restablecer-password" element={<ResetPasswordPage />} />

          {/* Rutas Protegidas por Layout Principal */}
          <Route
            element={user ? <MainLayout /> : <Navigate to="/login" replace />}
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route element={<RoleGuard roles={ROLES_MODULO.DASHBOARD} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>

            {/* Módulos de Administración */}
            <Route element={<RoleGuard roles={ROLES_MODULO.USUARIOS} />}>
              <Route path="/usuarios" element={<UsersPage />} />
            </Route>

            {/* Módulos de Catálogos */}
            <Route element={<RoleGuard roles={ROLES_MODULO.CLIENTES} />}>
              <Route path="/clientes" element={<ClientsPage />} />
            </Route>
            <Route element={<RoleGuard roles={ROLES_MODULO.PRODUCTOS} />}>
              <Route path="/productos" element={<ProductsPage />} />
            </Route>
            <Route element={<RoleGuard roles={ROLES_MODULO.TIPOS_PRECIO} />}>
              <Route path="/tipos-precio" element={<PriceTypesPage />} />
            </Route>
            <Route element={<RoleGuard roles={ROLES_MODULO.OPCIONES} />}>
              <Route path="/opciones" element={<SettingsPage />} />
            </Route>
            <Route element={<RoleGuard roles={ROLES_MODULO.DATOS_EMPRESA} />}>
              <Route path="/datos-empresa" element={<CompanyPage />} />
            </Route>

            {/* Módulos de Vehículos */}
            <Route element={<RoleGuard roles={ROLES_MODULO.VEHICULOS} />}>
              <Route path="/vehiculos" element={<VehiclesPage />} />
              <Route path="/vehiculos/nuevo" element={<VehicleFormPage />} />
              <Route
                path="/vehiculos/editar/:id"
                element={<VehicleFormPage />}
              />
            </Route>

            {/* Módulos Operativos */}
            <Route element={<RoleGuard roles={ROLES_MODULO.PEDIDOS} />}>
              <Route path="/pedidos" element={<OrdersPage />} />
              <Route path="/orders/new" element={<OrderCreatePage />} />
              <Route path="/orders/:id" element={<OrderDetailsPage />} />
              <Route path="/orders/:id/editar" element={<OrderEditPage />} />
            </Route>
            <Route element={<RoleGuard roles={ROLES_MODULO.COTIZACIONES} />}>
              <Route path="/cotizaciones" element={<QuotesPage />} />
              <Route path="/cotizaciones/nueva" element={<QuoteCreatePage />} />
              <Route path="/cotizaciones/:id" element={<QuoteDetailsPage />} />
            </Route>
            <Route element={<RoleGuard roles={ROLES_MODULO.DESPACHOS} />}>
              <Route path="/despachos" element={<DispatchesPage />} />
              <Route
                path="/despachos/nuevo"
                element={<DispatchCreatePage />}
              />
              <Route path="/despachos/:id" element={<DispatchDetailsPage />} />
            </Route>
            <Route element={<RoleGuard roles={ROLES_MODULO.MI_RUTA} />}>
              <Route path="/despachos/mi-ruta" element={<RepartidorRoutePage />} />
            </Route>

            {/* Módulo de Compras */}
            <Route element={<RoleGuard roles={ROLES_MODULO.PROVEEDORES} />}>
              <Route path="/proveedores" element={<SuppliersPage />} />
            </Route>
            <Route element={<RoleGuard roles={ROLES_MODULO.COMPRAS} />}>
              <Route path="/compras" element={<PurchasesPage />} />
              <Route path="/compras/nueva" element={<PurchaseCreatePage />} />
              <Route path="/compras/:id" element={<PurchaseDetailsPage />} />
            </Route>

            {/* Informes */}
            <Route element={<RoleGuard roles={ROLES_MODULO.INFORMES} />}>
              <Route path="/informes/ventas" element={<SalesReportPage />} />
              <Route path="/informes/utilidad" element={<ProfitReportPage />} />
              <Route path="/informes/productos" element={<ProductsReportPage />} />
            </Route>

            {/* Bodega: informes de inventario y toma física */}
            <Route element={<RoleGuard roles={ROLES_MODULO.INFORMES} />}>
              <Route path="/bodega/inventario" element={<InventoryReportPage />} />
              <Route path="/bodega/inventario-actual" element={<WarehouseInventoryPage />} />
            </Route>
            <Route element={<RoleGuard roles={ROLES_MODULO.TOMA_FISICA} />}>
              <Route path="/bodega/toma-fisica" element={<PhysicalCountsPage />} />
              <Route path="/bodega/toma-fisica/:id" element={<PhysicalCountPage />} />
            </Route>

            {/* Instructivo */}
            <Route element={<RoleGuard roles={ROLES_MODULO.AYUDA} />}>
              <Route path="/ayuda" element={<HelpPage />} />
            </Route>
          </Route>

          {/* Captura de rutas inexistentes */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
