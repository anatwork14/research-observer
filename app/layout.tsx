import type { Metadata } from "next";
import Script from "next/script";
import "katex/dist/katex.min.css";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research Observer",
  description: "A convention-driven observer for research notes, experiments, figures, and progress.",
};

const uiBootstrap = `
(() => {
  try {
    const root = document.documentElement;
    const read = (key, fallback) => localStorage.getItem(key) ?? fallback;
    root.dataset.leftRail = read("research-observer-left-rail", "open");
    root.dataset.rightRail = read("research-observer-right-rail", "open");
    root.dataset.focus = read("research-observer-focus", "off");
  } catch {}
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script
          id="research-observer-ui-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: uiBootstrap }}
        />
        {children}
      </body>
    </html>
  );
}
