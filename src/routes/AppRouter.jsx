import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { LoginPage } from "../modules/auth/pages/LoginPage";
import { MainLayout } from "../components/layout/MainLayout";
import { RoleGuard } from "./RoleGuard";
import { ROLES_MODULO } from "../config/roles";
import { Loader2 } from "lucide-react";

// Carga perezosa (Lazy Loading) de las páginas
const DashboardPage = lazy(() =>
  import("../modules/dashboard/pages/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const UsersPage = lazy(() =>
  import("../modules/users/pages/UsersPage").then((m) => ({
    default: m.UsersPage,
  })),
);
const ClientsPage = lazy(() =>
  import("../modules/clients/pages/ClientsPage").then((m) => ({
    default: m.ClientsPage,
  })),
);
const ProductsPage = lazy(() =>
  import("../modules/products/pages/ProductsPage").then((m) => ({
    default: m.ProductsPage,
  })),
);
const VehiclesPage = lazy(() =>
  import("../modules/vehicles/pages/VehiclesPage").then((m) => ({
    default: m.VehiclesPage,
  })),
);
// Importación del nuevo formulario de vehículos
const VehicleFormPage = lazy(() =>
  import("../modules/vehicles/pages/VehicleFormPage").then((m) => ({
    default: m.VehicleFormPage,
  })),
);
const OrdersPage = lazy(() =>
  import("../modules/orders/pages/OrdersPage").then((m) => ({
    default: m.OrdersPage,
  })),
);
const OrderCreatePage = lazy(() =>
  import("../modules/orders/pages/OrderCreatePage").then((m) => ({
    default: m.OrderCreatePage,
  })),
);
const OrderDetailsPage = lazy(() =>
  import("../modules/orders/pages/OrderDetailsPage").then((m) => ({
    default: m.OrderDetailsPage,
  })),
);
const DispatchesPage = lazy(() =>
  import("../modules/dispatches/pages/DispatchesPage").then((m) => ({
    default: m.DispatchesPage,
  })),
);
const DispatchCreatePage = lazy(() =>
  import("../modules/dispatches/pages/DispatchCreatePage").then((m) => ({
    default: m.DispatchCreatePage,
  })),
);
const DispatchDetailsPage = lazy(() =>
  import("../modules/dispatches/pages/DispatchDetailsPage").then((m) => ({
    default: m.DispatchDetailsPage,
  })),
);
const RepartidorRoutePage = lazy(() =>
  import("../modules/dispatches/pages/RepartidorRoutePage").then((m) => ({
    default: m.RepartidorRoutePage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("../modules/auth/pages/ResetPasswordPage").then((m) => ({
    default: m.ResetPasswordPage,
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
          </Route>

          {/* Captura de rutas inexistentes */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
