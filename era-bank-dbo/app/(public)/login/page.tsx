import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-dbo-muted">…</div>}>
      <LoginClient />
    </Suspense>
  );
}
