import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { LoginPage } from "../modules/auth/pages/LoginPage";
import { MainLayout } from "../components/layout/MainLayout";
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
          {/* Ruta pública */}
          <Route
            path="/login"
            element={
              !user ? <LoginPage /> : <Navigate to="/dashboard" replace />
            }
          />

          {/* Rutas Protegidas por Layout Principal */}
          <Route
            element={user ? <MainLayout /> : <Navigate to="/login" replace />}
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Módulos de Administración */}
            <Route path="/usuarios" element={<UsersPage />} />

            {/* Módulos de Catálogos */}
            <Route path="/clientes" element={<ClientsPage />} />
            <Route path="/productos" element={<ProductsPage />} />

            {/* Módulos de Vehículos */}
            <Route path="/vehiculos" element={<VehiclesPage />} />
            <Route path="/vehiculos/nuevo" element={<VehicleFormPage />} />
            <Route path="/vehiculos/editar/:id" element={<VehicleFormPage />} />

            {/* Módulos Operativos */}
            <Route path="/pedidos" element={<OrdersPage />} />
            <Route path="/orders/new" element={<OrderCreatePage />} />
            <Route path="/orders/:id" element={<OrderDetailsPage />} />
            <Route path="/despachos" element={<DispatchesPage />} />
            <Route path="/despachos/nuevo" element={<DispatchCreatePage />} />
            <Route path="/despachos/:id" element={<DispatchDetailsPage />} />
          </Route>

          {/* Captura de rutas inexistentes */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
