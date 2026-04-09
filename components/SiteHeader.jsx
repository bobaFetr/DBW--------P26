"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const NAV_ITEMS = [
  { key: "home", href: "/", label: "Home" },
  { key: "about", href: "/about", label: "About" },
  { key: "concerts", href: "/concerts", label: "Concerts" },
  { key: "albums", href: "/albums", label: "Albums" },
  { key: "singles", href: "/singles", label: "Singles" },
  { key: "merch", href: "/merch", label: "Merch" },
  { key: "news", href: "/news", label: "News" },
  { key: "timeline", href: "/timeline", label: "Timeline" },
  { key: "members", href: "/members", label: "Members" },
  { key: "gallery", href: "/gallery", label: "Gallery" },
  { key: "admin", href: "/admin", label: "Admin" }
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

    return NAV_ITEMS.find((item) => item.href === normalizedPath)?.key ?? "home";
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
        {NAV_ITEMS.map((item) => {
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
            {NAV_ITEMS.map((item) => {
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
          </div>
        </nav>
      </div>
    </header>
  );
}
