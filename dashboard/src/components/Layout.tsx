import { useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { clearToken } from "../api/client";

export default function Layout() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <Link to="/apps" className="text-lg font-semibold text-gray-900">
          iOS App Agent
        </Link>
        <button
          onClick={() => {
            clearToken();
            navigate("/login");
          }}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          Sign out
        </button>
      </nav>
      <main className="max-w-5xl mx-auto py-8 px-4">
        <Outlet />
      </main>
    </div>
  );
}
