"use client";

import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

type BottomNavItem = {
  label: string;
  icon: LucideIcon;
};

type BottomNavProps = {
  items: BottomNavItem[];
  activeLabel: string;
  onSelect: (label: string) => void;
};

type BottomNavStyle = CSSProperties & {
  "--nav-columns": number;
};

export default function BottomNav({ items, activeLabel, onSelect }: BottomNavProps) {
  const style: BottomNavStyle = { "--nav-columns": items.length };

  return (
    <nav className="bottom-nav" style={style} aria-label="Main navigation">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.label}
            className={activeLabel === item.label ? "nav-item active" : "nav-item"}
            onClick={() => onSelect(item.label)}
          >
            <Icon aria-hidden="true" />
            <small>{item.label}</small>
          </button>
        );
      })}
    </nav>
  );
}
