import React from "react";
import ConfirmProvider from "./components/ConfirmProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConfirmProvider>{children}</ConfirmProvider>;
}


