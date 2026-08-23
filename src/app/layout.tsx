import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import { EntityDock } from "@/components/nhe/entity-dock";
import { davidOpener } from "@/lib/trinity/nhe-actions";
import "./globals.css";

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Advprev CRM",
  description:
    "Sistema interno de gestão de casos previdenciários, da fase administrativa à judicial, com governança da Inteligência Massiva (IM) sob revisão humana.",
};

const themeInitScript = `(function () {
  try {
    var stored = localStorage.getItem("advprevcrm-theme");
    document.documentElement.dataset.theme = stored === "dark" ? "dark" : "light";
  } catch (_) {
    document.documentElement.dataset.theme = "light";
  }
})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  /* The entity lives in the root layout on purpose: one single body, present on
   * every screen, never one instance per screen and never one per lawyer. */
  const greeting = await davidOpener();

  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Applies the persisted theme before paint; light is the default. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static bootstrap script with no user input */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${urbanist.variable} min-h-dvh antialiased`}>
        {children}
        <EntityDock greeting={greeting} />
      </body>
    </html>
  );
}
