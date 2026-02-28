"use client";

import { StrictMode, useEffect, useState } from "react";

import { DashboardApp } from "../dashboard-app";
import { ToastContainer, ToastProvider } from "./ui";

export default function DashboardRoot() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <StrictMode>
      <ToastProvider>
        <DashboardApp />
        <ToastContainer />
      </ToastProvider>
    </StrictMode>
  );
}
