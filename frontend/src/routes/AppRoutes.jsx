import React from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import DashboardLayout from "../layouts/DashboardLayout";
import ProtectedRoute from "../components/ProtectedRoute";
import { useAuth } from "../hooks/useAuth";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Products from "../pages/Products";
import ProductEdit from "../pages/ProductEdit";
import Sales from "../pages/Sales";
import Stock from "../pages/Stock";
import Users from "../pages/Users";
import Reports from "../pages/Reports";
import Backup from "../pages/Backup";

function PublicRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <p className="state-message">Carregando sessão...</p>;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function AdminRoute() {
  const { isAdmin } = useAuth();

  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/stock" element={<Stock />} />

          <Route element={<AdminRoute />}>
            <Route path="/products" element={<Products />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/products/:id/edit" element={<ProductEdit />} />
            <Route path="/stock/products/:id/edit" element={<ProductEdit />} />
            <Route path="/users" element={<Users />} />
            <Route path="/backup" element={<Backup />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default AppRoutes;
