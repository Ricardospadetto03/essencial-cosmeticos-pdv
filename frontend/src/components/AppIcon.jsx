import React from "react";

function AppIcon({ name }) {
  if (name === "dashboard") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12.5 12 5l8 7.5" />
        <path d="M6.5 10.5V20h11V10.5" />
      </svg>
    );
  }

  if (name === "products") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8l8-4 8 4-8 4-8-4Z" />
        <path d="M4 8v8l8 4 8-4V8" />
      </svg>
    );
  }

  if (name === "sales") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5h2l2.4 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 8H7" />
        <circle cx="10" cy="19" r="1.4" />
        <circle cx="17" cy="19" r="1.4" />
      </svg>
    );
  }

  if (name === "stock") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 8l9-5 9 5-9 5-9-5Z" />
        <path d="M3 12l9 5 9-5" />
      </svg>
    );
  }

  if (name === "reports") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 20V8m7 12V4m7 16v-8" />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <circle cx="17.5" cy="9" r="2.5" />
      </svg>
    );
  }

  if (name === "replenishment") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16v12H4z" />
        <path d="M8 10h8M8 14h5" />
      </svg>
    );
  }

  if (name === "expiration") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="13" r="7" />
        <path d="M12 10v4l3 2M9 3h6" />
      </svg>
    );
  }

  if (name === "movement") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h14M14 6l6 6-6 6" />
      </svg>
    );
  }

  if (name === "pending") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </svg>
    );
  }

  if (name === "history") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 2.6-6.3M3 4v5h5" />
      </svg>
    );
  }

  if (name === "cash-close") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16v10H4z" />
        <path d="M8 12h4M15 10.5v3" />
      </svg>
    );
  }

  if (name === "cash-reopen") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 13a6 6 0 1 0 2-4.5" />
        <path d="M3 7v5h5" />
        <path d="M12 10v4M10 12h4" />
      </svg>
    );
  }

  if (name === "logout") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 7h-4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4" />
        <path d="M11 12h9M17 8l4 4-4 4" />
      </svg>
    );
  }

  if (name === "backup") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v8" />
        <path d="m8.5 7.5 3.5 3.5 3.5-3.5" />
        <path d="M5 13.5v4a2.5 2.5 0 0 0 2.5 2.5h9a2.5 2.5 0 0 0 2.5-2.5v-4" />
      </svg>
    );
  }

  return (
    <span>
      {String(name || "")
        .slice(0, 2)
        .toUpperCase() || "ID"}
    </span>
  );
}

export default AppIcon;
