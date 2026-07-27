import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoginPage } from "../modules/auth/pages/LoginPage";
import { MainLayout } from "../components/layout/MainLayout";
import { DashboardPage } from "../modules/dashboard/pages/DashboardPage";

// Componente temporal para módulos en construcción (Fase 3)
const PlaceholderModule = ({ title, desc }) => (
  <div className="bg-white p-12 rounded-xl border border-slate-200 text-center max-w-xl mx-auto my-12">
    <h2 className="text-xl font-bold text-slate-800">{title}</h2>
    <p className="text-sm text-slate-500 mt-2">{desc}</p>
    <div className="mt-6 inline-block bg-primary/10 text-primary font-semibold text-xs px-4 py-2 rounded-lg">
      Módulo listo para ser desarrollado en la Fase 3
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

          {/* Rutas operativas de la demostración */}
          <Route
            path="/pedidos"
            element={
              <PlaceholderModule
                title="Módulo: Toma de Pedidos"
                desc="Aquí el Vendedor podrá buscar clientes, agregar productos y generar nuevas órdenes."
              />
            }
          />
          <Route
            path="/despachos"
            element={
              <PlaceholderModule
                title="Módulo: Órdenes de Despacho"
                desc="Aquí el Despachador podrá agrupar múltiples pedidos en un vehículo y trazar las rutas."
              />
            }
          />
          <Route
            path="/clientes"
            element={
              <PlaceholderModule
                title="Módulo: Gestión de Clientes"
                desc="Listado, historial y creación de clientes multi-empresa."
              />
            }
          />
          <Route
            path="/productos"
            element={
              <PlaceholderModule
                title="Módulo: Catálogo de Productos"
                desc="Administración de inventario, precios y categorías."
              />
            }
          />
          <Route
            path="/vehiculos"
            element={
              <PlaceholderModule
                title="Módulo: Flota de Vehículos"
                desc="Control de conductores, placas y capacidad de carga en kg."
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
