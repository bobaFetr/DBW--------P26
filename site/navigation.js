const HOME_PAGE = "mainPage.html";
const HOME_ALIASES = new Set(["", "index.html", "mainpage.html", "logoinheader.html"]);

const NAV_ITEMS = [
  { key: "home", href: HOME_PAGE, label: "Home" },
  { key: "about", href: "About.html", label: "About" },
  { key: "concerts", href: "Concerts.html", label: "Concerts" },
  { key: "albums", href: "Albums.html", label: "Albums" },
  { key: "singles", href: "Singles.html", label: "Singles" },
  { key: "merch", href: "Merch.html", label: "Merch" },
  { key: "news", href: "News.html", label: "News" },
  { key: "timeline", href: "Timeline.html", label: "Timeline" },
  { key: "members", href: "members.html", label: "Members" },
  { key: "gallery", href: "Gallery.html", label: "Gallery" }
];

function inferPageKey() {
  const currentPage = window.location.pathname.split("/").pop().toLowerCase();
  if (HOME_ALIASES.has(currentPage)) {
    return "home";
  }

  const matched = NAV_ITEMS.find((item) => item.href.toLowerCase() === currentPage);
  return matched ? matched.key : "home";
}

function renderNavLinks(activeKey, mobile = false) {
  return NAV_ITEMS.map((item) => {
    const isActive = item.key === activeKey;
    const activeAttrs = isActive ? ' aria-current="page"' : "";

    if (mobile) {
      const activeClass = isActive ? ' class="active"' : "";
      return `<a href="${item.href}"${activeAttrs}${activeClass}>${item.label}</a>`;
    }

    const buttonClass = isActive ? ' class="active"' : "";
    return `<a href="${item.href}"${activeAttrs}><button${buttonClass}>${item.label}</button></a>`;
  }).join("");
}

function renderHeader(activeKey) {
  const headerMount = document.getElementById("site-header");
  if (!headerMount) {
    return;
  }

  headerMount.innerHTML = `
    <header>
      <div class="mobile-header-bar">
        <button id="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">&#9776;</button>
        <a href="${HOME_PAGE}" class="mobile-brand">
          <img src="/logo.ico" alt="Paralyze logo" />
          <span>PARALYZE</span>
        </a>
        <div class="mobile-spacer" aria-hidden="true"></div>
      </div>

      <div id="menu-overlay"></div>

      <nav id="mobile-menu" aria-label="Mobile navigation" aria-hidden="true">
        ${renderNavLinks(activeKey, true)}
      </nav>

      <div class="header-content">
        <h1>PARALYZE</h1>
        <nav class="desktop-menu" aria-label="Primary navigation">
          <div class="header-logo">
            <a href="${HOME_PAGE}">
              <img src="/logo.ico" alt="Paralyze logo" />
            </a>
          </div>
          <div class="menu-links">
            ${renderNavLinks(activeKey, false)}
          </div>
        </nav>
      </div>
    </header>
  `;
}

function renderFooter() {
  const footerMount = document.getElementById("site-footer");
  if (!footerMount) {
    return;
  }

  footerMount.innerHTML = `
    <footer>
      <h5>&copy; 2026 Paralyze</h5>
      <h4>All Rights Reserved</h4>
      <div>
        <a href="https://mail.google.com/mail/?view=cm&fs=1&to=bobata1236@gmail.com">Support guy!</a>
      </div>
      <div class="social-links">
        <a href="https://www.youtube.com/@deathbywish" target="_blank" rel="noreferrer">
          <img src="/youtube_icon.png" alt="YouTube" width="30" height="30" />
        </a>
      </div>
    </footer>
  `;
}

function wireMobileMenu() {
  const menuBtn = document.getElementById("menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  const menuOverlay = document.getElementById("menu-overlay");
  const mobileQuery = window.matchMedia("(max-width: 768px)");

  if (!menuBtn || !mobileMenu || !menuOverlay) {
    return;
  }

  function closeMobileMenu() {
    mobileMenu.classList.remove("active");
    menuOverlay.classList.remove("active");
    document.body.classList.remove("menu-open");
    menuBtn.setAttribute("aria-expanded", "false");
    mobileMenu.setAttribute("aria-hidden", "true");
  }

  function openMobileMenu() {
    if (!mobileQuery.matches) {
      return;
    }

    mobileMenu.classList.add("active");
    menuOverlay.classList.add("active");
    document.body.classList.add("menu-open");
    menuBtn.setAttribute("aria-expanded", "true");
    mobileMenu.setAttribute("aria-hidden", "false");
  }

  function toggleMobileMenu() {
    if (!mobileQuery.matches) {
      return;
    }

    if (mobileMenu.classList.contains("active")) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  menuBtn.addEventListener("click", toggleMobileMenu);
  menuOverlay.addEventListener("click", closeMobileMenu);

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });

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

  closeMobileMenu();
}

document.addEventListener("DOMContentLoaded", () => {
  const activeKey = document.body.dataset.page || inferPageKey();
  renderHeader(activeKey);
  renderFooter();
  wireMobileMenu();
});
