import * as SQLite from "expo-sqlite";
import type { BoardSnapshot, OutboxRow, Proc } from "./types";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const opened = await SQLite.openDatabaseAsync("clinic-nurse.db");
      await opened.execAsync(`
        CREATE TABLE IF NOT EXISTS session (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          token TEXT NOT NULL,
          full_name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS snapshot_by_login (
          login TEXT PRIMARY KEY NOT NULL,
          json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY NOT NULL,
          procedure_id TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS card_error (
          login TEXT NOT NULL,
          procedure_id TEXT NOT NULL,
          message TEXT NOT NULL,
          PRIMARY KEY (login, procedure_id)
        );
        CREATE TABLE IF NOT EXISTS device_pref (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      await migrate(opened);
      return opened;
    })();
  }
  return dbPromise;
}

async function migrate(opened: SQLite.SQLiteDatabase): Promise<void> {
  const sessionCols = await opened.getAllAsync<{ name: string }>("PRAGMA table_info(session)");
  if (!sessionCols.some((col) => col.name === "login")) {
    await opened.execAsync("ALTER TABLE session ADD COLUMN login TEXT NOT NULL DEFAULT ''");
  }
  const outCols = await opened.getAllAsync<{ name: string }>("PRAGMA table_info(outbox)");
  if (!outCols.some((col) => col.name === "owner_login")) {
    await opened.execAsync("ALTER TABLE outbox ADD COLUMN owner_login TEXT NOT NULL DEFAULT ''");
    await opened.execAsync("DELETE FROM outbox WHERE owner_login = ''");
  }
}

export type StoredSession = { token: string; fullName: string; login: string };

export async function loadSession(): Promise<StoredSession | null> {
  const row = await (await db()).getFirstAsync<{ token: string; full_name: string; login: string }>(
    "SELECT token, full_name, login FROM session WHERE id = 1",
  );
  if (!row?.login) return null;
  return { token: row.token, fullName: row.full_name, login: row.login };
}

export async function saveSession(token: string, fullName: string, login: string): Promise<void> {
  await (await db()).runAsync(
    `INSERT INTO session (id, token, full_name, login) VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET token = excluded.token, full_name = excluded.full_name, login = excluded.login`,
    token,
    fullName,
    login,
  );
}

export async function clearSession(): Promise<void> {
  await (await db()).runAsync("DELETE FROM session WHERE id = 1");
}

export async function loadOrgNo(): Promise<string> {
  const row = await (await db()).getFirstAsync<{ value: string }>(
    "SELECT value FROM device_pref WHERE key = 'orgNo'",
  );
  return row?.value ?? "";
}

export async function saveOrgNo(orgNo: string): Promise<void> {
  const value = orgNo.trim();
  if (!value) return;
  await (await db()).runAsync(
    `INSERT INTO device_pref (key, value) VALUES ('orgNo', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    value,
  );
}

export async function loadSnapshot(login: string): Promise<BoardSnapshot | null> {
  const row = await (await db()).getFirstAsync<{ json: string }>(
    "SELECT json FROM snapshot_by_login WHERE login = ?",
    login,
  );
  if (!row) return null;
  return JSON.parse(row.json) as BoardSnapshot;
}

export async function saveSnapshot(login: string, snapshot: BoardSnapshot): Promise<void> {
  await (await db()).runAsync(
    `INSERT INTO snapshot_by_login (login, json) VALUES (?, ?)
     ON CONFLICT(login) DO UPDATE SET json = excluded.json`,
    login,
    JSON.stringify(snapshot),
  );
}

export async function patchOrder(login: string, procedureId: string, patch: Partial<Proc>): Promise<void> {
  const current = await loadSnapshot(login);
  if (!current) return;
  current.orders = current.orders.map((order) =>
    order.id === procedureId ? { ...order, ...patch } : order,
  );
  await saveSnapshot(login, current);
}

export async function loadOutbox(login: string): Promise<OutboxRow[]> {
  const rows = await (await db()).getAllAsync<{
    id: string;
    procedure_id: string;
    created_at: string;
    owner_login: string;
  }>(
    "SELECT id, procedure_id, created_at, owner_login FROM outbox WHERE owner_login = ? ORDER BY created_at ASC",
    login,
  );
  return rows.map((row) => ({
    id: row.id,
    procedureId: row.procedure_id,
    createdAt: row.created_at,
    ownerLogin: row.owner_login,
  }));
}

export async function enqueueCheckIn(login: string, procedureId: string): Promise<void> {
  const existing = await (await db()).getFirstAsync<{ id: string }>(
    "SELECT id FROM outbox WHERE procedure_id = ? AND owner_login = ?",
    procedureId,
    login,
  );
  if (existing) return;
  await (await db()).runAsync(
    "INSERT INTO outbox (id, procedure_id, created_at, owner_login) VALUES (?, ?, ?, ?)",
    `${login}:${procedureId}:${Date.now()}`,
    procedureId,
    new Date().toISOString(),
    login,
  );
}

export async function removeOutbox(id: string): Promise<void> {
  await (await db()).runAsync("DELETE FROM outbox WHERE id = ?", id);
}

export async function loadCardErrors(login: string): Promise<Map<string, string>> {
  const rows = await (await db()).getAllAsync<{ procedure_id: string; message: string }>(
    "SELECT procedure_id, message FROM card_error WHERE login = ?",
    login,
  );
  return new Map(rows.map((row) => [row.procedure_id, row.message]));
}

export async function setCardError(login: string, procedureId: string, message: string): Promise<void> {
  await (await db()).runAsync(
    `INSERT INTO card_error (login, procedure_id, message) VALUES (?, ?, ?)
     ON CONFLICT(login, procedure_id) DO UPDATE SET message = excluded.message`,
    login,
    procedureId,
    message,
  );
}

export async function clearCardError(login: string, procedureId: string): Promise<void> {
  await (await db()).runAsync(
    "DELETE FROM card_error WHERE login = ? AND procedure_id = ?",
    login,
    procedureId,
  );
}
