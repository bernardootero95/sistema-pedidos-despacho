import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoginPage } from "../modules/auth/pages/LoginPage";
import { MainLayout } from "../components/layout/MainLayout";
import { DashboardPage } from "../modules/dashboard/pages/DashboardPage";
import { ClientsPage } from "../modules/clients/pages/ClientsPage";
import { ProductsPage } from "../modules/products/pages/ProductsPage";
import { VehiclesPage } from "../modules/vehicles/pages/VehiclesPage";
import { OrdersPage } from "../modules/orders/pages/OrdersPage";
import { DispatchesPage } from "../modules/dispatches/pages/DispatchesPage";
import { UsersPage } from "../modules/users/pages/UsersPage";

export const AppRouter = () => {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública */}
        <Route
          path="/login"
          element={!user ? <LoginPage /> : <Navigate to="/dashboard" replace />}
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
          <Route path="/vehiculos" element={<VehiclesPage />} />

          {/* Módulos Operativos */}
          <Route path="/pedidos" element={<OrdersPage />} />
          <Route path="/despachos" element={<DispatchesPage />} />
        </Route>

        {/* Captura de rutas inexistentes */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
