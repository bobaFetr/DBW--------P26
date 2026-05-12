"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BOTTOM_ITEMS = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/singles", label: "Music", icon: "♪" },
  { href: "/concerts", label: "Live", icon: "★" },
  { href: "/gallery", label: "Gallery", icon: "◈" },
  { href: "/news", label: "News", icon: "✦" }
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  function isActive(href) {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  }

  return (
    <nav className="mobile-bottom-nav" aria-label="Quick navigation">
      {BOTTOM_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
        >
          <span className="bn-icon" aria-hidden="true">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
