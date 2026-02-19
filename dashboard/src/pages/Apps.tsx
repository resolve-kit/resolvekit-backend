import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface App {
  id: string;
  name: string;
  bundle_id: string | null;
  created_at: string;
}

export default function Apps() {
  const [apps, setApps] = useState<App[]>([]);
  const [newName, setNewName] = useState("");
  const [newBundleId, setNewBundleId] = useState("");

  useEffect(() => {
    api<App[]>("/v1/apps").then(setApps);
  }, []);

  async function createApp() {
    if (!newName.trim()) return;
    const app = await api<App>("/v1/apps", {
      method: "POST",
      body: JSON.stringify({
        name: newName,
        bundle_id: newBundleId || null,
      }),
    });
    setApps([app, ...apps]);
    setNewName("");
    setNewBundleId("");
  }

  async function deleteApp(id: string) {
    await api(`/v1/apps/${id}`, { method: "DELETE" });
    setApps(apps.filter((a) => a.id !== id));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Your Apps</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">App Name</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="My iOS App"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">
            Bundle ID (optional)
          </label>
          <input
            value={newBundleId}
            onChange={(e) => setNewBundleId(e.target.value)}
            placeholder="com.example.app"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={createApp}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Create
        </button>
      </div>

      <div className="space-y-3">
        {apps.map((app) => (
          <div
            key={app.id}
            className="bg-white rounded-lg shadow p-4 flex items-center justify-between"
          >
            <div>
              <h2 className="font-medium">{app.name}</h2>
              {app.bundle_id && (
                <p className="text-sm text-gray-500">{app.bundle_id}</p>
              )}
            </div>
            <div className="flex gap-2 text-sm">
              <Link
                to={`/apps/${app.id}/config`}
                className="text-blue-600 hover:underline"
              >
                Config
              </Link>
              <Link
                to={`/apps/${app.id}/functions`}
                className="text-blue-600 hover:underline"
              >
                Functions
              </Link>
              <Link
                to={`/apps/${app.id}/sessions`}
                className="text-blue-600 hover:underline"
              >
                Sessions
              </Link>
              <Link
                to={`/apps/${app.id}/playbooks`}
                className="text-blue-600 hover:underline"
              >
                Playbooks
              </Link>
              <Link
                to={`/apps/${app.id}/api-keys`}
                className="text-blue-600 hover:underline"
              >
                API Keys
              </Link>
              <button
                onClick={() => deleteApp(app.id)}
                className="text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {apps.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No apps yet. Create one above.
          </p>
        )}
      </div>
    </div>
  );
}
