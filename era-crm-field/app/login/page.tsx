"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Login failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="mb-4 text-2xl font-semibold text-[#34495E]">ERA Satellite</h1>
      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-[#D5DADF] bg-white p-6">
        <input
          className="h-9 w-full rounded-lg border border-[#D5DADF] px-3"
          placeholder="Login"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
        <input
          type="password"
          className="h-9 w-full rounded-lg border border-[#D5DADF] px-3"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          className="h-9 w-full rounded-lg bg-[#2980B9] text-sm font-medium text-white"
        >
          Sign in
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-[#7F8C8D]">
        Or use SSO from ERA Finance / Orchestrator
      </p>
    </main>
  );
}
