"use client";

import { usePathname } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Company pages have their own full-screen, standalone layout — no ITGA sidebar
  if (pathname.startsWith("/company")) {
    return <>{children}</>;
  }

  return <AppLayout>{children}</AppLayout>;
}
