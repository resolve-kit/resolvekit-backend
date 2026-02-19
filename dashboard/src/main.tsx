import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Apps from "./pages/Apps";
import AppConfig from "./pages/AppConfig";
import Functions from "./pages/Functions";
import Sessions from "./pages/Sessions";
import ApiKeys from "./pages/ApiKeys";
import Playbooks from "./pages/Playbooks";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/apps" element={<Apps />} />
          <Route path="/apps/:appId/config" element={<AppConfig />} />
          <Route path="/apps/:appId/functions" element={<Functions />} />
          <Route path="/apps/:appId/sessions" element={<Sessions />} />
          <Route path="/apps/:appId/api-keys" element={<ApiKeys />} />
          <Route path="/apps/:appId/playbooks" element={<Playbooks />} />
        </Route>
        <Route path="*" element={<Navigate to="/apps" />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
