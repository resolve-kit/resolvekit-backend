import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../api/client";

interface AppNavProps {
  appId: string;
  appName?: string;
}

const TABS = [
  { label: "Config", slug: "config" },
  { label: "Functions", slug: "functions" },
  { label: "Sessions", slug: "sessions" },
  { label: "API Keys", slug: "api-keys" },
  { label: "Playbooks", slug: "playbooks" },
];

export function AppNav({ appId, appName: propAppName }: AppNavProps) {
  const [appName, setAppName] = useState(propAppName || "");
  const location = useLocation();

  useEffect(() => {
    if (!propAppName) {
      api<{ id: string; name: string }>(`/v1/apps/${appId}`)
        .then((a) => setAppName(a.name))
        .catch(() => {});
    }
  }, [appId, propAppName]);

  return (
    <div className="mb-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-subtle mb-3">
        <Link
          to="/apps"
          className="hover:text-body transition-colors"
        >
          Apps
        </Link>
        <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-body font-medium">
          {appName || "Loading..."}
        </span>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-border gap-0.5">
        {TABS.map((tab) => {
          const path = `/apps/${appId}/${tab.slug}`;
          const isActive = location.pathname === path;
          return (
            <Link
              key={tab.slug}
              to={path}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-strong"
                  : "text-subtle hover:text-body"
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
