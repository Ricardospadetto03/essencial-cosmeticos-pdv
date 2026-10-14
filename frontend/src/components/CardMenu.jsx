import React from "react";
import { Link } from "react-router-dom";
import AppIcon from "./AppIcon";

function CardMenu({
  icon = "products",
  title,
  description,
  to,
  onClick,
  badge = "",
  badgeTone = "neutral",
  animationIndex = 0,
  compact = false,
}) {
  const content = (
    <>
      {badge ? <span className={`menu-card-badge menu-card-badge-${badgeTone}`}>{badge}</span> : null}
      <span className="menu-card-icon">
        <AppIcon name={icon} />
      </span>
      <h3>{title}</h3>
      {description ? <p className="muted">{description}</p> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`menu-card menu-card-button${compact ? " menu-card-compact" : ""}`}
        onClick={onClick}
        style={{ "--card-order": animationIndex }}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={to}
      className={`menu-card${compact ? " menu-card-compact" : ""}`}
      style={{ "--card-order": animationIndex }}
    >
      {content}
    </Link>
  );
}

export default CardMenu;
