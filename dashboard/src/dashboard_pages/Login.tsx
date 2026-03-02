import { type FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, setToken } from "../api/client";
import ResolveKitWordmark from "../components/ResolveKitWordmark";
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
  const location = useLocation();
  const [isSignup, setIsSignup] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode")?.toLowerCase();
    const signup = params.get("signup")?.toLowerCase();
    return mode === "register" || mode === "signup" || signup === "1" || signup === "true";
  });
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
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode")?.toLowerCase();
    const signup = params.get("signup")?.toLowerCase();
    const shouldSignup = mode === "register" || mode === "signup" || signup === "1" || signup === "true";
    setIsSignup((prev) => (prev === shouldSignup ? prev : shouldSignup));
  }, [location.search]);

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
    <div className="relative min-h-screen overflow-hidden bg-canvas px-4 py-8 md:px-8 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(44,132,255,0.2),transparent_34%),radial-gradient(circle_at_84%_14%,rgba(27,186,131,0.14),transparent_36%)]" />
      <div className="pointer-events-none absolute -left-28 top-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-6 h-80 w-80 rounded-full bg-success/12 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-6xl items-start gap-8 lg:grid-cols-[1fr_420px]">
        <section className="order-2 glass-panel rounded-[2rem] border border-border/70 p-6 shadow-card md:p-9 lg:order-1">
          <div className="space-y-1">
            <ResolveKitWordmark resolveClassName="text-accent" kitClassName="text-accent" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent/85">Command Center</p>
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-strong md:text-4xl">
            Embedded LLM support that can explain, guide, and act inside your app
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-subtle">
            Integrate SDK chat into mobile or web apps, configure agent behavior centrally, and allow approved on-device
            function calls to resolve user problems in real time.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {["SDK embedded chat", "Approved tool actions", "Operator trace"].map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold text-subtle"
              >
                {pill}
              </span>
            ))}
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              ["Agent context", "Prompt + KB + session signals before every reply"],
              ["Action safety", "User approval required for sensitive function calls"],
              ["Operator trace", "Full timeline of turns, tools, and outcomes"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-border bg-surface px-3 py-3 shadow-card">
                <p className="text-xs font-semibold text-strong">{title}</p>
                <p className="mt-1 text-xs text-subtle leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="order-1 glass-panel rounded-[2rem] border border-border/70 p-6 shadow-card lg:order-2">
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Operator Access</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-strong">
              {isSignup
                ? signupIntent === "create-org"
                  ? "Register Organization"
                  : "Create Account to Join"
                : "Sign In"}
            </h2>
            <p className="mt-1 text-sm text-subtle">
              {isSignup
                ? signupIntent === "create-org"
                  ? "Create your workspace and define your organization ID."
                  : "Create your account now, then accept invitation in Organization Admin."
                : "Access your app support command center."}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-danger-dim bg-danger-subtle px-4 py-3">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSignupIntent("create-org")}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    signupIntent === "create-org"
                      ? "border-accent-dim bg-accent-subtle text-accent"
                      : "border-border bg-surface text-subtle hover:border-border-2 hover:text-body"
                  }`}
                >
                  Register Organization
                </button>
                <button
                  type="button"
                  onClick={() => setSignupIntent("join-org")}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    signupIntent === "join-org"
                      ? "border-accent-dim bg-accent-subtle text-accent"
                      : "border-border bg-surface text-subtle hover:border-border-2 hover:text-body"
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
              <div className="rounded-lg border border-border bg-surface px-3 py-2">
                <p className="text-xs text-subtle leading-relaxed">
                  Ask your organization admin to send an invitation to this email, then accept it from Organization
                  Admin after signup.
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
              <div className="rounded-lg border border-border bg-surface px-3 py-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-subtle">Password requirements</p>
                <ul className="space-y-1 text-xs text-subtle">
                  {passwordGuidance.requirements.map((requirement) => (
                    <li key={requirement}>• {requirement}</li>
                  ))}
                  {signupIntent === "create-org" && <li>• Organization IDs use lowercase letters, numbers, and hyphens</li>}
                </ul>
              </div>
            )}

            <Button type="submit" variant="primary" size="md" loading={isLoading} className="w-full">
              {isSignup
                ? signupIntent === "create-org"
                  ? "Register Organization"
                  : "Create Account to Join"
                : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-subtle">
            {isSignup ? "Already have an account?" : "Need an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError("");
                setOrganizationId("");
                setOrganizationName("");
              }}
              className="font-semibold text-accent transition-colors hover:text-accent-hover"
            >
              {isSignup ? "Sign in" : "Sign up"}
            </button>
          </p>
        </section>
      </div>
    </div>
  );
}
