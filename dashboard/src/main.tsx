import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./dashboard-app";
import { ToastProvider, ToastContainer } from "./components/ui";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <App />
      <ToastContainer />
    </ToastProvider>
  </StrictMode>
);
