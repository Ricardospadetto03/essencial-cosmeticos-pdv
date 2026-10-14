import React, { useState } from "react";
import { Outlet } from "react-router-dom";

function AuthLayout() {
  const [logoVisible, setLogoVisible] = useState(true);

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <div className="auth-logo-wrap">
          <div className="auth-logo-spotlight">
            {logoVisible ? (
              <img
                className="auth-logo"
                src="/logo-essencial.png"
                alt="Logo Essencial Cosméticos"
                onError={() => setLogoVisible(false)}
              />
            ) : (
              <div className="auth-logo-fallback">EC</div>
            )}
          </div>
        </div>
        <Outlet />
      </section>
    </main>
  );
}

export default AuthLayout;
