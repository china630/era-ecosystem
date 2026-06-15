import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

type ChallengeRecord = {
  identifier: string;
  fin?: string;
  createdAt: number;
};

const challenges = new Map<string, ChallengeRecord>();

@Injectable()
export class AsanSimaStubAdapter {
  startChallenge(input: { identifier: string; fin?: string }) {
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

  completeChallenge(transactionId: string) {
    const record = challenges.get(transactionId);
    if (!record) return { verified: false as const };
    if (Date.now() - record.createdAt > 15 * 60 * 1000) {
      challenges.delete(transactionId);
      return { verified: false as const };
    }
    challenges.delete(transactionId);
    return {
      verified: true as const,
      identifier: record.identifier,
      fin: record.fin ?? record.identifier,
    };
  }
}
