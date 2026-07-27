import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoginPage } from "../modules/auth/pages/LoginPage";
import { MainLayout } from "../components/layout/MainLayout";
import { DashboardPage } from "../modules/dashboard/pages/DashboardPage";
import { ClientsPage } from "../modules/clients/pages/ClientsPage";
import { ProductsPage } from "../modules/products/pages/ProductsPage";
import { VehiclesPage } from "../modules/vehicles/pages/VehiclesPage";

// Componente temporal únicamente para los 2 módulos operativos que haremos en el siguiente commit
const PlaceholderModule = ({ title, desc }) => (
  <div className="bg-white p-12 rounded-xl border border-slate-200 text-center max-w-xl mx-auto my-12 shadow-sm">
    <h2 className="text-xl font-bold text-slate-800">{title}</h2>
    <p className="text-sm text-slate-500 mt-2">{desc}</p>
    <div className="mt-6 inline-block bg-primary/10 text-primary font-semibold text-xs px-4 py-2 rounded-lg">
      Próximo a desarrollarse en el siguiente paso operativo
    </div>
  </div>
);

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

          {/* Módulos de Catálogos (Ya integrados y funcionales para la presentación) */}
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/productos" element={<ProductsPage />} />
          <Route path="/vehiculos" element={<VehiclesPage />} />

          {/* Rutas operativas (Pendientes para el cierre de la presentación) */}
          <Route
            path="/pedidos"
            element={
              <PlaceholderModule
                title="Módulo: Toma de Pedidos"
                desc="Aquí el Vendedor podrá buscar clientes, agregar productos con cálculo automático y generar nuevas órdenes."
              />
            }
          />
          <Route
            path="/despachos"
            element={
              <PlaceholderModule
                title="Módulo: Órdenes de Despacho"
                desc="Aquí el Despachador podrá agrupar múltiples pedidos pendientes en un vehículo y trazar la ruta del repartidor."
              />
            }
          />
        </Route>

        {/* Captura de rutas inexistentes */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
