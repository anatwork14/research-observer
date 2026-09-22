import type { Metadata } from "next";
import Script from "next/script";
import "katex/dist/katex.min.css";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Observaire",
  description: "A research intelligence workspace for evidence, experiments, literature, timelines, and evolving ideas.",
};

const uiBootstrap = `
(() => {
  try {
    const root = document.documentElement;
    const read = (key, fallback) => localStorage.getItem(key) ?? fallback;
    const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    root.dataset.theme = read("research-observer-theme", preferredTheme);
    root.dataset.leftRail = read("research-observer-left-rail", "open");
    root.dataset.rightRail = read("research-observer-right-rail", "open");
    root.dataset.focus = read("research-observer-focus", "off");
  } catch {}
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <Script
          id="observaire-ui-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: uiBootstrap }}
        />
        {children}
      </body>
    </html>
  );
}
