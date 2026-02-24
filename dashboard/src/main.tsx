import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import AgentPrompt from "./pages/AgentPrompt";
import AuditLog from "./pages/AuditLog";
import Apps from "./pages/Apps";
import ApiKeys from "./pages/ApiKeys";
import Functions from "./pages/Functions";
import LimitsConfig from "./pages/LimitsConfig";
import LlmConfig from "./pages/LlmConfig";
import OrganizationAdmin from "./pages/OrganizationAdmin";
import Playbooks from "./pages/Playbooks";
import Sessions from "./pages/Sessions";
import { ToastProvider, ToastContainer } from "./components/ui";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/apps" element={<Apps />} />
          <Route path="/organization" element={<OrganizationAdmin />} />
          <Route path="/apps/:appId/agent" element={<AgentPrompt />} />
          <Route path="/apps/:appId/llm" element={<LlmConfig />} />
          <Route path="/apps/:appId/limits" element={<LimitsConfig />} />
          <Route path="/apps/:appId/functions" element={<Functions />} />
          <Route path="/apps/:appId/sessions" element={<Sessions />} />
          <Route path="/apps/:appId/api-keys" element={<ApiKeys />} />
          <Route path="/apps/:appId/playbooks" element={<Playbooks />} />
          <Route path="/apps/:appId/audit" element={<AuditLog />} />
        </Route>
        <Route path="*" element={<Navigate to="/apps" />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <App />
      <ToastContainer />
    </ToastProvider>
  </StrictMode>
);
