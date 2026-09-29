"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const NAV_GROUPS = [
  {
    label: "Music",
    items: [
      { key: "albums", href: "/albums/", label: "Albums" },
      { key: "singles", href: "/singles/", label: "Singles" }
    ]
  },
  {
    label: "Live",
    items: [
      { key: "concerts", href: "/concerts/", label: "Concerts" }
    ]
  },
  {
    label: "Media",
    items: [
      { key: "gallery", href: "/gallery/", label: "Gallery" },
      { key: "airbrush-board", href: "/airbrush-board/", label: "Airbrush Board" },
      { key: "news", href: "/news/", label: "News" }
    ]
  },
  {
    label: "Band",
    items: [
      { key: "about", href: "/about/", label: "About" },
      { key: "members", href: "/members/", label: "Members" },
      { key: "timeline", href: "/timeline/", label: "Timeline" },
      { key: "merch", href: "/merch/", label: "Merch" }
    ]
  }
];

const ALL_NAV_ITEMS = [
  { key: "home", href: "/", label: "Home" },
  ...NAV_GROUPS.flatMap((g) => g.items)
];

function normalizePath(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/$/, "");
}

export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const activeKey = useMemo(() => {
    const normalizedPath = normalizePath(pathname);
    return ALL_NAV_ITEMS.find((item) => normalizePath(item.href) === normalizedPath)?.key ?? "home";
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 769px)");
    function closeOnDesktop() {
      if (desktop.matches) setMenuOpen(false);
    }
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function closeMobileMenu() {
    setMenuOpen(false);
  }

  return (
    <header>
      <div className="mobile-header-bar">
        <button
          id="menu-btn"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((current) => !current)}
          type="button"
        >
          &#9776;
        </button>
        <a href="/" className="mobile-brand" onClick={closeMobileMenu}>
          <img src="/logo.ico" alt="Paralyze logo" />
          <span>PARALYZE</span>
        </a>
        <div className="mobile-spacer" aria-hidden="true" />
      </div>

      <div
        id="menu-overlay"
        className={menuOpen ? "active" : ""}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />

      <nav
        id="mobile-menu"
        className={menuOpen ? "active" : ""}
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
      >
        <a
          href="/"
          aria-current={activeKey === "home" ? "page" : undefined}
          className={activeKey === "home" ? "active" : undefined}
          onClick={closeMobileMenu}
        >
          Home
        </a>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mobile-menu-group">
            <span className="mobile-menu-group-label">{group.label}</span>
            {group.items.map((item) => {
              const isActive = item.key === activeKey;
              return (
                <a
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={isActive ? "active" : undefined}
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="header-content">
        <h1>PARALYZE</h1>
        <nav className="desktop-menu" aria-label="Primary navigation">
          <div className="header-logo">
            <a href="/">
              <img src="/logo.ico" alt="Paralyze logo" />
            </a>
          </div>
          <div className="menu-links">
            <a href="/" aria-current={activeKey === "home" ? "page" : undefined}>
              <span className={`nav-button${activeKey === "home" ? " active" : ""}`}>Home</span>
            </a>
            {NAV_GROUPS.map((group, groupIndex) => (
              <span key={group.label} className="nav-group">
                {groupIndex > 0 && <span className="nav-sep" aria-hidden="true" />}
                {group.items.map((item) => {
                  const isActive = item.key === activeKey;
                  return (
                    <a
                      key={item.key}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className={`nav-button${isActive ? " active" : ""}`}>
                        {item.label}
                      </span>
                    </a>
                  );
                })}
              </span>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
