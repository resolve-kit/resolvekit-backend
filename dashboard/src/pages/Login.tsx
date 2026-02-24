import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api/client";
import { Button, Input } from "../components/ui";

interface PasswordGuidance {
  minimum_length: number;
  requirements: string[];
}

type SignupIntent = "create-org" | "join-org";

const DEFAULT_PASSWORD_GUIDANCE: PasswordGuidance = {
  minimum_length: 10,
  requirements: [
    "At least 10 characters",
    "At least one uppercase letter",
    "At least one lowercase letter",
    "At least one number",
    "At least one special character",
    "No whitespace characters",
  ],
};

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [signupIntent, setSignupIntent] = useState<SignupIntent>("create-org");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [passwordGuidance, setPasswordGuidance] = useState<PasswordGuidance>(DEFAULT_PASSWORD_GUIDANCE);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSignup) return;

    let cancelled = false;
    api<PasswordGuidance>("/v1/auth/password-guidance")
      .then((guidance) => {
        if (!cancelled && Array.isArray(guidance.requirements) && guidance.requirements.length > 0) {
          setPasswordGuidance(guidance);
        }
      })
      .catch(() => {
        // Keep local fallback guidance if request fails.
      });

    return () => {
      cancelled = true;
    };
  }, [isSignup]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const path = isSignup ? "/v1/auth/signup" : "/v1/auth/login";
      const body = isSignup
        ? signupIntent === "create-org"
          ? {
              email,
              name,
              password,
              signup_intent: "create_org",
              organization_name: organizationName,
              organization_public_id: organizationId || undefined,
            }
          : {
              email,
              name,
              password,
              signup_intent: "create_org",
              organization_name: `${name.trim() || "My"}'s Organization`,
            }
        : { email, password };
      const res = await api<{ access_token: string }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setToken(res.access_token);
      if (isSignup && signupIntent === "join-org") {
        navigate("/organization");
      } else {
        navigate("/apps");
      }
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
          <div className="flex flex-col items-center mb-8">
            <h1 className="font-display text-xl font-semibold text-strong">
              {isSignup
                ? signupIntent === "create-org"
                  ? "Register Organization"
                  : "Register to Join Organization"
                : "Welcome back"}
            </h1>
            <p className="text-sm text-subtle mt-1">
              {isSignup
                ? signupIntent === "create-org"
                  ? "Create your organization and define the organization ID to share with your team"
                  : "Create your account first, then accept your invitation in Organization Admin"
                : "Sign in to your dashboard"}
            </p>
          </div>

          {error && (
            <div className="bg-danger-subtle border border-danger-dim rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSignupIntent("create-org")}
                  className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                    signupIntent === "create-org"
                      ? "bg-accent-subtle text-accent border-accent-dim"
                      : "bg-surface text-subtle border-border hover:text-body"
                  }`}
                >
                  Register Organization
                </button>
                <button
                  type="button"
                  onClick={() => setSignupIntent("join-org")}
                  className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                    signupIntent === "join-org"
                      ? "bg-accent-subtle text-accent border-accent-dim"
                      : "bg-surface text-subtle border-border hover:text-body"
                  }`}
                >
                  Join Organization
                </button>
              </div>
            )}

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
            {isSignup && signupIntent === "create-org" && (
              <Input
                type="text"
                label="Organization Name"
                placeholder="Acme Mobile Team"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />
            )}
            {isSignup && signupIntent === "create-org" && (
              <Input
                type="text"
                label="Organization ID (optional)"
                placeholder="acme-mobile"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
              />
            )}
            {isSignup && signupIntent === "join-org" && (
              <div className="rounded-lg border border-border bg-canvas/40 px-3 py-2">
                <p className="text-xs text-subtle">
                  Ask your organization admin to send an invitation to this email, then accept it from Organization Admin after signup.
                </p>
              </div>
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
            {isSignup && (
              <div className="rounded-lg border border-border bg-canvas/40 px-3 py-2">
                <p className="text-xs font-medium text-subtle mb-1">
                  Password requirements
                </p>
                <ul className="text-xs text-subtle space-y-1">
                  {passwordGuidance.requirements.map((requirement) => (
                    <li key={requirement}>• {requirement}</li>
                  ))}
                  {signupIntent === "create-org" && (
                    <li>• Organization IDs use lowercase letters, numbers, and hyphens</li>
                  )}
                </ul>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isLoading}
              className="w-full"
            >
              {isSignup
                ? signupIntent === "create-org"
                  ? "Register Organization"
                  : "Create Account to Join"
                : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-sm text-subtle mt-6">
            {isSignup ? "Already have an account?" : "Need an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError("");
                setOrganizationId("");
                setOrganizationName("");
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
