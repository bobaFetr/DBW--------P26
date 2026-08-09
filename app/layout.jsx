import "./globals.css";
import NowPlayingBar from "../components/NowPlayingBar";
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
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader />
        <NowPlayingBar />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
