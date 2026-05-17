"use client";

import { usePathname } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublicCompanyProfile = /^\/company\/\d+$/.test(pathname);

  if (pathname.startsWith("/company") && !isPublicCompanyProfile) {
    return <>{children}</>;
  }

  return <AppLayout>{children}</AppLayout>;
}
