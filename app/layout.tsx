import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AppShell } from "@/components/layout/app-shell";
import { AbsenceDialog } from "@/components/dialogs/absence-dialog";
import { SolverDialog } from "@/components/dialogs/solver-dialog";

export const metadata: Metadata = {
  title: "CVAL Planning",
  description: "Gestion du planning des secrétaires médicales",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <QueryProvider>
          <AppShell>{children}</AppShell>
          <AbsenceDialog />
          <SolverDialog />
        </QueryProvider>
      </body>
    </html>
  );
}
