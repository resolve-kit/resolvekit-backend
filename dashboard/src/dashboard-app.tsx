import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./dashboard_pages/Login";
import AgentPrompt from "./dashboard_pages/AgentPrompt";
import AuditLog from "./dashboard_pages/AuditLog";
import Apps from "./dashboard_pages/Apps";
import ApiKeys from "./dashboard_pages/ApiKeys";
import Languages from "./dashboard_pages/Languages";
import Functions from "./dashboard_pages/Functions";
import KnowledgeBases from "./dashboard_pages/KnowledgeBases";
import LimitsConfig from "./dashboard_pages/LimitsConfig";
import LlmConfig from "./dashboard_pages/LlmConfig";
import AppKnowledgeBases from "./dashboard_pages/AppKnowledgeBases";
import OrganizationAdmin from "./dashboard_pages/OrganizationAdmin";
import Playbooks from "./dashboard_pages/Playbooks";
import Sessions from "./dashboard_pages/Sessions";
import ChatTheme from "./dashboard_pages/ChatTheme";
import PlaybookCopilotProvider from "./components/PlaybookCopilotProvider";

export function RootRedirect() {
  const token = localStorage.getItem("token");
  return <Navigate to={token ? "/apps" : "/login"} replace />;
}

export function DashboardApp() {
  return (
    <BrowserRouter>
      <PlaybookCopilotProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/apps" element={<Apps />} />
            <Route path="/knowledge-bases" element={<KnowledgeBases />} />
            <Route path="/organization" element={<OrganizationAdmin />} />
            <Route path="/apps/:appId/agent" element={<AgentPrompt />} />
            <Route path="/apps/:appId/knowledge-bases" element={<AppKnowledgeBases />} />
            <Route path="/apps/:appId/llm" element={<LlmConfig />} />
            <Route path="/apps/:appId/chat-theme" element={<ChatTheme />} />
            <Route path="/apps/:appId/limits" element={<LimitsConfig />} />
            <Route path="/apps/:appId/functions" element={<Functions />} />
            <Route path="/apps/:appId/sessions" element={<Sessions />} />
            <Route path="/apps/:appId/api-keys" element={<ApiKeys />} />
            <Route path="/apps/:appId/languages" element={<Languages />} />
            <Route path="/apps/:appId/playbooks" element={<Playbooks />} />
            <Route path="/apps/:appId/audit" element={<AuditLog />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </PlaybookCopilotProvider>
    </BrowserRouter>
  );
}

export const App = DashboardApp;
