import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  asanMode,
  assertLiveConfigured,
  ConfigError,
} from "./live-mode";

/**
 * ASAN İmza / SİMA auth seam (P1-8).
 *
 * **BANK_ASAN_MODE** (via `live-mode.asanMode`):
 * - `stub` (default) — in-memory challenge map (lab / UAT).
 * - `sandbox` — treated as stub until partner sandbox endpoint is wired.
 * - `live` — awaits HTTP bridge; requires `BANK_ASAN_BASE_URL`, `BANK_ASAN_API_KEY`.
 *   Optional finance-style port: `BANK_ASAN_FINANCE_BRIDGE_URL`.
 */

export type AsanChallengeStartInput = { identifier: string; fin?: string };

export type AsanChallengeStartResult = {
  transactionId: string;
  redirectUrl: string;
};

export type AsanChallengeCompleteResult =
  | { verified: false }
  | { verified: true; identifier: string; fin: string };

export interface AsanSimaAdapter {
  startChallenge(
    input: AsanChallengeStartInput,
  ): Promise<AsanChallengeStartResult> | AsanChallengeStartResult;
  completeChallenge(
    transactionId: string,
  ): Promise<AsanChallengeCompleteResult> | AsanChallengeCompleteResult;
}

type ChallengeRecord = {
  identifier: string;
  fin?: string;
  createdAt: number;
};

const challenges = new Map<string, ChallengeRecord>();

@Injectable()
export class StubAsanSimaAdapter implements AsanSimaAdapter {
  startChallenge(input: AsanChallengeStartInput): AsanChallengeStartResult {
    const transactionId = randomUUID();
    challenges.set(transactionId, {
      identifier: input.identifier.trim().toUpperCase(),
      fin: input.fin?.trim().toUpperCase(),
      createdAt: Date.now(),
    });
    return {
      transactionId,
      redirectUrl: `http://127.0.0.1:3211/login?asanTx=${transactionId}&channel=RETAIL`,
    };
  }

  completeChallenge(transactionId: string): AsanChallengeCompleteResult {
    const record = challenges.get(transactionId);
    if (!record) return { verified: false };
    if (Date.now() - record.createdAt > 15 * 60 * 1000) {
      challenges.delete(transactionId);
      return { verified: false };
    }
    challenges.delete(transactionId);
    return {
      verified: true,
      identifier: record.identifier,
      fin: record.fin ?? record.identifier,
    };
  }
}

/**
 * Live ASAN/SİMA via HTTP (finance-style port compatible JSON).
 * startChallenge **awaits** the partner response — never returns success on fire-and-forget.
 */
@Injectable()
export class FinancePortAsanSimaAdapter implements AsanSimaAdapter {
  private readonly log = new Logger(FinancePortAsanSimaAdapter.name);

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async startChallenge(
    input: AsanChallengeStartInput,
  ): Promise<AsanChallengeStartResult> {
    const transactionId = randomUUID();
    const bridge = process.env.BANK_ASAN_FINANCE_BRIDGE_URL?.trim();
    const target = bridge ?? `${this.baseUrl.replace(/\/$/, "")}/v1/challenge`;
    let res: Response;
    try {
      res = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          transactionId,
          identifier: input.identifier,
          fin: input.fin,
        }),
      });
    } catch (err) {
      this.log.warn(`ASAN startChallenge network failed: ${String(err)}`);
      throw new ConfigError(
        `BANK_ASAN_MODE=live startChallenge failed: ${String(err)}`,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ConfigError(
        `BANK_ASAN_MODE=live startChallenge HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      );
    }
    const data = (await res.json().catch(() => ({}))) as {
      transactionId?: string;
      redirectUrl?: string;
    };
    return {
      transactionId: data.transactionId?.trim() || transactionId,
      redirectUrl:
        data.redirectUrl?.trim() ||
        `${this.baseUrl.replace(/\/$/, "")}/redirect/${transactionId}`,
    };
  }

  async completeChallenge(
    _transactionId: string,
  ): Promise<AsanChallengeCompleteResult> {
    throw new ConfigError(
      "BANK_ASAN_MODE=live completeChallenge requires partner callback wiring (YC-E3) — not a stub success",
    );
  }
}

export function createAsanSimaAdapter(): AsanSimaAdapter {
  const mode = asanMode();
  if (mode === "stub" || mode === "sandbox") {
    return new StubAsanSimaAdapter();
  }
  if (mode === "live") {
    assertLiveConfigured(
      mode,
      {
        BANK_ASAN_BASE_URL: process.env.BANK_ASAN_BASE_URL,
        BANK_ASAN_API_KEY: process.env.BANK_ASAN_API_KEY,
      },
      "BANK_ASAN_MODE=live",
    );
    return new FinancePortAsanSimaAdapter(
      process.env.BANK_ASAN_BASE_URL!.trim(),
      process.env.BANK_ASAN_API_KEY!.trim(),
    );
  }
  return new StubAsanSimaAdapter();
}

/** @deprecated Use StubAsanSimaAdapter / createAsanSimaAdapter — kept for DI token compat. */
@Injectable()
export class AsanSimaStubAdapter extends StubAsanSimaAdapter {
  startChallenge(input: AsanChallengeStartInput): AsanChallengeStartResult {
    const mode = asanMode();
    if (mode === "live") {
      assertLiveConfigured(
        mode,
        {
          BANK_ASAN_BASE_URL: process.env.BANK_ASAN_BASE_URL,
          BANK_ASAN_API_KEY: process.env.BANK_ASAN_API_KEY,
        },
        "BANK_ASAN_MODE=live",
      );
      throw new ConfigError(
        "BANK_ASAN_MODE=live requires live ASAN/SİMA adapter (YC-E3)",
      );
    }
    return super.startChallenge(input);
  }
}
