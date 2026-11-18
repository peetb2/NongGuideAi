import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NongGuide AI — แผงควบคุม Workspace",
  description: "จัดการบอท คีย์ API และติดตามการใช้งานระบบ NongGuide AI",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-appBg text-textMain min-h-screen flex antialiased selection:bg-brandBlue selection:text-white font-sans w-full">
      {children}
    </div>
  );
}
