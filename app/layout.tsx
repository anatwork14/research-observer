import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research Observer",
  description: "A convention-driven observer for research notes, experiments, figures, and progress.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
