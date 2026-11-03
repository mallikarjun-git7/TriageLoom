"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result =
        mode === "signup"
          ? await authClient.signUp.email({ name, email, password })
          : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? "Authentication failed.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080e1c] px-5 text-white">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#101a2d] p-8 shadow-2xl">
        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold tracking-[0.25em] text-cyan-400">
            TRIAGELOOM
          </p>
          <h1 className="text-3xl font-bold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Incident intelligence and reliability operations.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === "signup" && (
            <label className="block space-y-2 text-sm text-slate-300">
              <span>Full name</span>
              <input
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={160}
                autoComplete="name"
              />
            </label>
          )}

          <label className="block space-y-2 text-sm text-slate-300">
            <span>Email address</span>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-300">
            <span>Password</span>
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          {mode === "signin" ? "New to TriageLoom?" : "Already registered?"}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
            }}
            className="ml-2 font-semibold text-cyan-400 hover:underline"
          >
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </div>

        <div className="mt-8 border-t border-slate-800 pt-5 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-white">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
