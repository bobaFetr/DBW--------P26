import "./globals.css";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export const metadata = {
  title: {
    default: "Paralyze",
    template: "Paralyze | %s"
  },
  description:
    "Official Paralyze site with pages for the band's story, music, concerts, news, and archive.",
  icons: {
    icon: "/logo.ico"
  },
  openGraph: {
    title: "Paralyze",
    description:
      "Official Paralyze site with pages for the band's story, music, concerts, news, and archive.",
    type: "website"
  }
};

export const viewport = {
  themeColor: "#111111"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.cdnfonts.com/css/ft-vortex" rel="stylesheet" />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
