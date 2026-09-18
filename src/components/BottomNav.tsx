"use client";

import { useRef } from "react";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
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
  const pointerActivatedLabel = useRef<string | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, label: string) {
    if (event.pointerType === "mouse" || !event.isPrimary) return;

    pointerActivatedLabel.current = label;
    onSelect(label);
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>, label: string) {
    if (pointerActivatedLabel.current === label) {
      pointerActivatedLabel.current = null;
      event.preventDefault();
      return;
    }

    onSelect(label);
  }

  return (
    <nav className="bottom-nav" style={style} aria-label="Main navigation">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.label}
            className={activeLabel === item.label ? "nav-item active" : "nav-item"}
            onPointerDown={(event) => handlePointerDown(event, item.label)}
            onClick={(event) => handleClick(event, item.label)}
          >
            <Icon aria-hidden="true" />
            <small>{item.label}</small>
          </button>
        );
      })}
    </nav>
  );
}
