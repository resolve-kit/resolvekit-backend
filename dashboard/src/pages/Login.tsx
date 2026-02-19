import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api/client";
import { Button, Input } from "../components/ui";

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const path = isSignup ? "/v1/auth/signup" : "/v1/auth/login";
      const body = isSignup ? { email, name, password } : { email, password };
      const res = await api<{ access_token: string }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setToken(res.access_token);
      navigate("/apps");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-canvas overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" />

      {/* Card */}
      <div className="relative w-full max-w-sm animate-fade-in-up">
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mb-4">
              <span className="text-white font-display font-bold text-lg leading-none">
                IA
              </span>
            </div>
            <h1 className="font-display text-xl font-semibold text-strong">
              {isSignup ? "Create Account" : "Welcome back"}
            </h1>
            <p className="text-sm text-subtle mt-1">
              {isSignup ? "Get started with iOS App Agent" : "Sign in to your dashboard"}
            </p>
          </div>

          {error && (
            <div className="bg-danger-subtle border border-danger-dim rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            {isSignup && (
              <Input
                type="text"
                label="Name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isSignup ? "new-password" : "current-password"}
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isLoading}
              className="w-full"
            >
              {isSignup ? "Create Account" : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-sm text-subtle mt-6">
            {isSignup ? "Already have an account?" : "Need an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError("");
              }}
              className="text-accent hover:text-accent-hover transition-colors font-medium"
            >
              {isSignup ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
