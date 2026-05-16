import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { NavigationProgress } from "@/components/ui/navigation-progress";
import "./globals.css";

export const metadata: Metadata = {
  title: "ITGA — IT Girls Academy",
  description: "La plateforme sociale pour les femmes dans la tech. Connectez-vous, partagez, grandissez ensemble.",
  icons: {
    icon: "/itga_logo.png",
    apple: "/itga_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full">
        <ThemeProvider>
          <NavigationProgress />
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
