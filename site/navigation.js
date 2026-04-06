const menuBtn = document.getElementById("menu-btn");
const mobileMenu = document.getElementById("mobile-menu");
const menuOverlay = document.getElementById("menu-overlay");
const mobileQuery = window.matchMedia("(max-width: 768px)");

function closeMobileMenu() {
  if (!mobileMenu || !menuOverlay || !menuBtn) {
    return;
  }

  mobileMenu.classList.remove("active");
  menuOverlay.classList.remove("active");
  document.body.classList.remove("menu-open");
  menuBtn.setAttribute("aria-expanded", "false");
}

function openMobileMenu() {
  if (!mobileMenu || !menuOverlay || !menuBtn || !mobileQuery.matches) {
    return;
  }

  mobileMenu.classList.add("active");
  menuOverlay.classList.add("active");
  document.body.classList.add("menu-open");
  menuBtn.setAttribute("aria-expanded", "true");
}

function toggleMobileMenu() {
  if (!mobileMenu || !mobileQuery.matches) {
    return;
  }

  if (mobileMenu.classList.contains("active")) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

function setActiveNavLink() {
  const currentPage = window.location.pathname.split("/").pop().toLowerCase() || "logoinheader.html";
  const allNavLinks = document.querySelectorAll(".desktop-menu a, #mobile-menu a");

  allNavLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) {
      return;
    }

    const hrefLower = href.toLowerCase();
    const isHome = currentPage === "" || currentPage === "index.html";

    if (currentPage === hrefLower || (isHome && hrefLower === "logoinheader.html")) {
      const btn = link.querySelector("button");
      if (btn) {
        btn.classList.add("active");
      } else {
        link.classList.add("active");
      }
    }
  });
}

if (menuBtn) {
  menuBtn.addEventListener("click", toggleMobileMenu);
}

if (menuOverlay) {
  menuOverlay.addEventListener("click", closeMobileMenu);
}

if (mobileMenu) {
  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });
}

window.addEventListener("resize", () => {
  if (!mobileQuery.matches) {
    closeMobileMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileMenu();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  if (!mobileQuery.matches) {
    closeMobileMenu();
  }
  setActiveNavLink();
});
