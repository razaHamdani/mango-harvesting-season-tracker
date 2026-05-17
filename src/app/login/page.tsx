"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sprout } from "lucide-react";
import { signInUser, signUpUser, resendConfirmation } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function BrandMark() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="grid place-items-center"
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background:
            "linear-gradient(135deg, var(--mango) 0%, var(--mango-deep) 100%)",
          boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 15%)",
          color: "var(--bark)",
        }}
      >
        <Sprout size={20} />
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--heading)",
        }}
      >
        AamDaata
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("landlord");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "confirmation-failed") {
      setError("Confirmation link is invalid or has expired. Request a new one below.");
    }
  }, []);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", password);

      if (isSignUp) {
        formData.set("full_name", fullName);
        formData.set("role", role);
        const result = await signUpUser(formData);

        if (result.error) {
          setError(result.error);
          return;
        }

        if (result.pendingConfirmation) {
          setPendingConfirmation(true);
          return;
        }

        router.push("/dashboard");
      } else {
        const result = await signInUser(formData);

        if (result.error) {
          setError(result.error);
          return;
        }

        router.push("/dashboard");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    setResendMessage("");
    await resendConfirmation(email);
    setResendLoading(false);
    setResendMessage("If an account exists for this email, a confirmation link has been sent.");
  }

  const isLocalDev =
    typeof window !== "undefined" &&
    window.location.hostname === "localhost";

  if (pendingConfirmation) {
    return (
      <div className="login-bg min-h-screen grid place-items-center px-4">
        <div
          className="w-full"
          style={{
            maxWidth: 380,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-lift)",
            padding: 28,
          }}
        >
          <div className="flex flex-col items-center text-center gap-2">
            <BrandMark />
            <h1 className="h-1 mt-2">Check your email</h1>
            <p
              className="mt-1"
              style={{ fontSize: 13, color: "var(--text-muted)" }}
            >
              We sent a confirmation link to <strong>{email}</strong>. Click it
              to activate your account, then sign in.
            </p>
          </div>
          <div className="flex flex-col gap-3 mt-5">
            {isLocalDev && (
              <span
                className="chip self-center"
                style={{ fontSize: 11.5 }}
              >
                Check{" "}
                <a
                  href="http://localhost:54324"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  Inbucket
                </a>{" "}
                for emails
              </span>
            )}
            {resendMessage && (
              <p
                className="text-center"
                style={{ fontSize: 13, color: "var(--text-muted)" }}
              >
                {resendMessage}
              </p>
            )}
            <Button
              variant="outline"
              onClick={handleResend}
              disabled={resendLoading}
              className="h-11"
            >
              {resendLoading ? "Sending…" : "Resend confirmation email"}
            </Button>
            <button
              type="button"
              className="text-center underline underline-offset-4 hover:text-foreground"
              style={{ fontSize: 13, color: "var(--text-muted)" }}
              onClick={() => {
                setPendingConfirmation(false);
                setIsSignUp(false);
              }}
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-bg min-h-screen grid place-items-center px-4">
      <div
        className="w-full"
        style={{
          maxWidth: 380,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-lift)",
          padding: 28,
        }}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <BrandMark />
          <h1 className="h-1 mt-1">Welcome back</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {isSignUp ? "Create your AamDaata account" : "Sign in to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
          {isSignUp && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="h-10 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  required
                >
                  <option value="landlord">Landlord</option>
                </select>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
            />
            {isSignUp && (
              <p
                style={{ fontSize: 11.5, color: "var(--text-muted)" }}
              >
                Min. 10 characters — must include uppercase, lowercase, and a number.
              </p>
            )}
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "var(--rust)" }}>{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-11"
          >
            {loading
              ? isSignUp
                ? "Creating account..."
                : "Signing in..."
              : isSignUp
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-2 text-center">
          <button
            type="button"
            className="underline underline-offset-4 hover:text-foreground"
            style={{ fontSize: 13, color: "var(--text-muted)" }}
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
          >
            {isSignUp
              ? "Already have an account? Log in"
              : "Don't have an account? Sign up"}
          </button>
          {!isSignUp && (
            <button
              type="button"
              className="underline underline-offset-4 hover:text-foreground"
              style={{ fontSize: 12.5, color: "var(--text-muted)" }}
              onClick={handleResend}
              disabled={resendLoading}
            >
              Resend confirmation
            </button>
          )}
        </div>

        {isLocalDev && (
          <div className="mt-5 flex justify-center">
            <span className="chip" style={{ fontSize: 11.5 }}>
              Check Inbucket for emails
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
