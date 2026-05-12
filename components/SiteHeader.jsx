"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const NAV_GROUPS = [
  {
    label: "Music",
    items: [
      { key: "albums", href: "/albums", label: "Albums" },
      { key: "singles", href: "/singles", label: "Singles" }
    ]
  },
  {
    label: "Live",
    items: [
      { key: "concerts", href: "/concerts", label: "Concerts" }
    ]
  },
  {
    label: "Media",
    items: [
      { key: "gallery", href: "/gallery", label: "Gallery" },
      { key: "news", href: "/news", label: "News" }
    ]
  },
  {
    label: "Band",
    items: [
      { key: "about", href: "/about", label: "About" },
      { key: "members", href: "/members", label: "Members" },
      { key: "timeline", href: "/timeline", label: "Timeline" },
      { key: "merch", href: "/merch", label: "Merch" }
    ]
  }
];

const ALL_NAV_ITEMS = [
  { key: "home", href: "/", label: "Home" },
  ...NAV_GROUPS.flatMap((g) => g.items)
];

const LEGACY_PATHS = {
  "/index.html": "home",
  "/mainPage.html": "home",
  "/logoinheader.html": "home",
  "/About.html": "about",
  "/Concerts.html": "concerts",
  "/Albums.html": "albums",
  "/Singles.html": "singles",
  "/Merch.html": "merch",
  "/News.html": "news",
  "/Timeline.html": "timeline",
  "/members.html": "members",
  "/Gallery.html": "gallery",
  "/admin.html": "admin"
};

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
    if (LEGACY_PATHS[normalizedPath]) {
      return LEGACY_PATHS[normalizedPath];
    }

    return ALL_NAV_ITEMS.find((item) => item.href === normalizedPath)?.key ?? "home";
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);

    return () => {
      document.body.classList.remove("menu-open");
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
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
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((current) => !current)}
          type="button"
        >
          &#9776;
        </button>
        <Link href="/" className="mobile-brand" onClick={closeMobileMenu}>
          <img src="/logo.ico" alt="Paralyze logo" />
          <span>PARALYZE</span>
        </Link>
        <div className="mobile-spacer" aria-hidden="true" />
      </div>

      <div
        id="menu-overlay"
        className={menuOpen ? "active" : ""}
        onClick={closeMobileMenu}
      />

      <nav
        id="mobile-menu"
        className={menuOpen ? "active" : ""}
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
      >
        <Link
          href="/"
          aria-current={activeKey === "home" ? "page" : undefined}
          className={activeKey === "home" ? "active" : undefined}
          onClick={closeMobileMenu}
        >
          Home
        </Link>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mobile-menu-group">
            <span className="mobile-menu-group-label">{group.label}</span>
            {group.items.map((item) => {
              const isActive = item.key === activeKey;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={isActive ? "active" : undefined}
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="header-content">
        <h1>PARALYZE</h1>
        <nav className="desktop-menu" aria-label="Primary navigation">
          <div className="header-logo">
            <Link href="/">
              <img src="/logo.ico" alt="Paralyze logo" />
            </Link>
          </div>
          <div className="menu-links">
            <Link href="/" aria-current={activeKey === "home" ? "page" : undefined}>
              <span className={`nav-button${activeKey === "home" ? " active" : ""}`}>Home</span>
            </Link>
            {NAV_GROUPS.map((group, groupIndex) => (
              <span key={group.label} style={{ display: "contents" }}>
                {groupIndex > 0 && <span className="nav-sep" aria-hidden="true" />}
                {group.items.map((item) => {
                  const isActive = item.key === activeKey;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className={`nav-button${isActive ? " active" : ""}`}>
                        {item.label}
                      </span>
                    </Link>
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
