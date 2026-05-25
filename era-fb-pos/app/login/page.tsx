"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CARD_CLASS } from "@/lib/design-system";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("waiter");
  const [password, setPassword] = useState("waiter");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Login failed");
      return;
    }
    router.push("/floor");
    router.refresh();
  }

  return (
    <div className="mx-auto mt-16 max-w-md">
      <div className={`${CARD_CLASS} p-6`}>
        <h1 className="mb-4 text-xl font-semibold">ERA F&B POS</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm">
            Login
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              type="password"
              className="mt-1 w-full rounded border px-2 py-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="w-full rounded bg-[#2980B9] px-3 py-2 text-white"
          >
            Sign in
          </button>
        </form>
        <p className="mt-3 text-xs text-[#7F8C8D]">
          Demo: waiter/waiter or manager/manager
        </p>
        {message && <p className="mt-2 text-sm text-red-600">{message}</p>}
      </div>
    </div>
  );
}
