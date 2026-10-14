import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

function DashboardLayout() {
  return (
    <div className="dashboard-shell">
      <Sidebar />
      <div className="content-wrap">
        <Header />
        <section className="page-card">
          <Outlet />
        </section>
      </div>
    </div>
  );
}

export default DashboardLayout;
