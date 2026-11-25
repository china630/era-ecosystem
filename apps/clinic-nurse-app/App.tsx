import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Application from "expo-application";
import * as Battery from "expo-battery";
import * as Updates from "expo-updates";
import {
  CLINIC_URL,
  fetchBoard,
  fetchMe,
  login,
  loginMeta,
  logout,
  postCheckIn,
  shouldAlwaysAskOrgNo,
} from "./src/api";
import { bakuDateDisplay, bakuTimeLabel, todayBakuYmd } from "./src/baku";
import { Board } from "./src/Board";
import { classifyCheckIn } from "./src/place-order";
import { copyFor, type Locale } from "./src/copy";
import {
  clearCardError,
  clearSession,
  enqueueCheckIn,
  loadCardErrors,
  loadLocale,
  loadOrgNo,
  loadOutbox,
  loadSession,
  loadSnapshot,
  patchOrder,
  removeOutbox,
  saveLocale,
  saveOrgNo,
  saveSession,
  saveSnapshot,
  setCardError,
} from "./src/store";
import {
  installUpdate,
  isKioskPaused,
  nativeLog,
  openDesktop,
  openSettings,
  openWifi,
  resumeKiosk,
  startKiosk,
  stopKiosk,
} from "clinic-nurse-kiosk";
import type { Proc } from "./src/types";

const UPDATE_URL = (
  process.env.EXPO_PUBLIC_UPDATE_URL ?? "https://app.era-365.online/tablet-apps/nurse"
).replace(/\/$/, "");
const KIOSK_PIN = process.env.EXPO_PUBLIC_KIOSK_PIN || "0000";
const SIX_HOURS = 6 * 60 * 60 * 1000;

export default function App() {
  const [locale, setLocale] = useState<Locale>("az");
  const t = copyFor(locale);
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [orgNo, setOrgNo] = useState("");
  // Default false so the org field is visible until loginMeta proves hostBound.
  const [hostBound, setHostBound] = useState(false);
  const [forceOrgNo, setForceOrgNo] = useState(shouldAlwaysAskOrgNo());
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootNonce, setBootNonce] = useState(0);
  const [orders, setOrders] = useState<Proc[]>([]);
  const [mineUnlinked, setMineUnlinked] = useState(false);
  const [dayEndHour, setDayEndHour] = useState(18);
  const [date, setDate] = useState(todayBakuYmd());
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [clock, setClock] = useState(bakuTimeLabel(new Date()));
  const [busy, setBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [batteryPct, setBatteryPct] = useState<number | null>(null);
  const [kioskPaused, setKioskPaused] = useState(false);
  const taps = useRef<number[]>([]);
  const tokenRef = useRef<string | null>(null);
  const loginRef = useRef<string | null>(null);
  const syncChain = useRef(Promise.resolve());
  tokenRef.current = token;

  const blankBoard = useCallback(() => {
    setOrders([]);
    setPending(0);
    setMineUnlinked(false);
    setSyncedAt(null);
  }, []);

  const dropSession = useCallback(async () => {
    await clearSession();
    tokenRef.current = null;
    loginRef.current = null;
    setToken(null);
    setFullName("");
    blankBoard();
  }, [blankBoard]);

  const paint = useCallback(async () => {
    const who = loginRef.current;
    if (!who) {
      blankBoard();
      return;
    }
    const snap = await loadSnapshot(who);
    const queue = await loadOutbox(who);
    const errors = await loadCardErrors(who);
    setPending(queue.length);
    if (!snap) {
      setOrders([]);
      setMineUnlinked(false);
      setSyncedAt(null);
      return;
    }
    const pendingIds = new Set(queue.map((row) => row.procedureId));
    setDate(snap.date);
    setDayEndHour(snap.dayEndHour);
    setMineUnlinked(snap.mineUnlinked);
    setSyncedAt(snap.syncedAt);
    const next: Proc[] = [];
    for (const order of snap.orders) {
      const status = pendingIds.has(order.id) && order.status === "SCHEDULED" ? "CHECKED_IN" : order.status;
      const message = errors.get(order.id);
      if (message && (status === "CHECKED_IN" || status === "COMPLETED")) {
        await clearCardError(who, order.id);
        next.push({ ...order, status, cardError: null });
      } else {
        next.push({ ...order, status, cardError: message ?? null });
      }
    }
    setOrders(next);
  }, [blankBoard]);

  const syncBody = useCallback(async () => {
    const current = tokenRef.current;
    const who = loginRef.current;
    if (!current || !who) return;
    const today = todayBakuYmd();
    const queue = await loadOutbox(who);
    for (const row of queue) {
      if (tokenRef.current !== current || loginRef.current !== who) return;
      const result = await postCheckIn(current, row.procedureId);
      const outcome = classifyCheckIn(result.status, result.code);
      if (outcome === "retry") {
        setOffline(true);
        return;
      }
      if (outcome === "auth") {
        await dropSession();
        return;
      }
      await removeOutbox(row.id);
      if (outcome === "terminal") {
        await patchOrder(who, row.procedureId, { status: "SCHEDULED" });
        await setCardError(who, row.procedureId, result.error || t.checkInFailed);
      } else {
        await clearCardError(who, row.procedureId);
      }
    }
    if (tokenRef.current !== current) return;
    const loaded = await fetchBoard(current, today, locale);
    if (loaded.status === 0 || loaded.status >= 500) {
      setOffline(true);
      await paint();
      return;
    }
    if (loaded.status === 401) {
      await dropSession();
      return;
    }
    if (loaded.snapshot && loginRef.current === who) {
      const errors = await loadCardErrors(who);
      for (const order of loaded.snapshot.orders) {
        if (errors.has(order.id) && (order.status === "CHECKED_IN" || order.status === "COMPLETED")) {
          await clearCardError(who, order.id);
        }
      }
      await saveSnapshot(who, loaded.snapshot);
      setOffline(false);
    }
    await paint();
  }, [dropSession, locale, paint, t.checkInFailed]);

  const sync = useCallback(() => {
    const run = syncChain.current.then(() => syncBody());
    syncChain.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, [syncBody]);

  // APK update check must not wait for login UI / storage / meta.
  useEffect(() => {
    const check = () => {
      void checkUpdates();
    };
    check();
    const id = setInterval(check, SIX_HOURS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);

  // Clock always ticks — even when boot/login is stuck.
  useEffect(() => {
    const clockId = setInterval(() => {
      setNow(Date.now());
      setClock(bakuTimeLabel(new Date()));
    }, 1000);
    return () => clearInterval(clockId);
  }, []);

  useEffect(() => {
    setKioskPaused(isKioskPaused());
    startKiosk();
    let cancelled = false;
    void (async () => {
      setBootError(null);
      setReady(false);
      nativeLog("NurseApp", `boot start clinic=${CLINIC_URL} alwaysOrg=${shouldAlwaysAskOrgNo()}`);
      try {
        if (shouldAlwaysAskOrgNo()) {
          setForceOrgNo(true);
          setHostBound(false);
        }
        try {
          const meta = await loginMeta();
          if (cancelled) return;
          if (shouldAlwaysAskOrgNo()) {
            setHostBound(false);
            setForceOrgNo(true);
          } else {
            setHostBound(meta.hostBound === true);
          }
          nativeLog("NurseApp", `loginMeta hostBound=${meta.hostBound}`);
        } catch (err) {
          // Meta failed → show orgNo so the nurse can still sign in.
          setHostBound(false);
          setForceOrgNo(true);
          nativeLog(
            "NurseApp",
            `loginMeta failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        const storedLocale = await loadLocale();
        if (cancelled) return;
        if (storedLocale === "az" || storedLocale === "ru" || storedLocale === "en") {
          setLocale(storedLocale);
        }
        setOrgNo(await loadOrgNo());
        const session = await loadSession();
        if (cancelled) return;
        if (session) {
          tokenRef.current = session.token;
          loginRef.current = session.login;
          setToken(session.token);
          setFullName(session.fullName);
          await paint();
        }
        // Always reveal UI — never stay on a spinner because a network call hung.
        setReady(true);
        nativeLog("NurseApp", `boot ready session=${Boolean(session)}`);
        if (session) {
          const me = await fetchMe(session.token);
          if (cancelled || loginRef.current !== session.login) return;
          if (me.kind === "unauthorized") {
            await dropSession();
          } else if (me.kind === "ok" && me.fullName) {
            setFullName(me.fullName);
            await saveSession(session.token, me.fullName, session.login);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        nativeLog("NurseApp", `boot failed: ${message}`);
        setBootError(message);
        setHostBound(false);
        setForceOrgNo(true);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootNonce, dropSession, paint]);

  useEffect(() => {
    if (!token) return;
    void sync();
    const id = setInterval(() => {
      void sync();
    }, 30_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [token, sync]);

  useEffect(() => {
    let alive = true;
    const read = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (!alive || level < 0) return;
        setBatteryPct(Math.round(level * 100));
      } catch {
        // Emulator or permission gap — hide the badge.
      }
    };
    void read();
    const id = setInterval(() => void read(), 60_000);
    const sub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      if (batteryLevel >= 0) setBatteryPct(Math.round(batteryLevel * 100));
    });
    return () => {
      alive = false;
      clearInterval(id);
      sub.remove();
    };
  }, []);

  const showOrgNo = forceOrgNo || !hostBound;

  async function onLogin() {
    setSigningIn(true);
    setLoginError(null);
    try {
      const who = loginName.trim();
      const org = showOrgNo ? orgNo.trim() : "";
      const session = await login({
        login: who,
        password,
        orgNo: org || undefined,
      });
      if (org) await saveOrgNo(org);
      await saveSession(session.token, session.fullName, session.login || who);
      tokenRef.current = session.token;
      loginRef.current = session.login || who;
      blankBoard();
      setFullName(session.fullName);
      setPassword("");
      setToken(session.token);
      await paint();
    } catch (err) {
      const message = err instanceof Error ? err.message : t.loginFailed;
      setLoginError(message);
      if (/orgno/i.test(message) || /organization/i.test(message)) {
        setForceOrgNo(true);
        setHostBound(false);
        nativeLog("NurseApp", `login requires orgNo: ${message}`);
      }
    } finally {
      setSigningIn(false);
    }
  }

  async function onLogout() {
    if (token) await logout(token);
    await clearSession();
    tokenRef.current = null;
    loginRef.current = null;
    setToken(null);
    setFullName("");
    blankBoard();
  }

  async function onCheckIn(id: string) {
    const who = loginRef.current;
    if (!token || !who || busy) return;
    setBusy(true);
    try {
      await patchOrder(who, id, { status: "CHECKED_IN" });
      await clearCardError(who, id);
      await enqueueCheckIn(who, id);
      await paint();
      await sync();
    } finally {
      setBusy(false);
    }
  }

  function onSecretTap() {
    const stamp = Date.now();
    taps.current = [...taps.current.filter((at) => stamp - at < 3000), stamp];
    if (taps.current.length >= 5) {
      taps.current = [];
      setPin("");
      setPinError(null);
      setPinOpen(true);
    }
  }

  function submitPin() {
    if (!KIOSK_PIN || pin !== KIOSK_PIN) {
      setPinError(t.pinWrong);
      return;
    }
    nativeLog("Kiosk", "PIN ok — leaveKiosk / adminMode");
    stopKiosk();
    setKioskPaused(true);
    setPinOpen(false);
  }

  function onResumeKiosk() {
    nativeLog("Kiosk", "admin resumeKiosk pressed");
    resumeKiosk();
    setKioskPaused(false);
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar hidden />
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {bakuDateDisplay(date)} {clock}
        </Text>
        <Text style={styles.headerText} numberOfLines={1}>
          {token ? fullName : ""}
        </Text>
        <View style={styles.langs}>
          {(["az", "ru", "en"] as const).map((code) => (
            <Pressable
              key={code}
              onPress={() => {
                setLocale(code);
                void saveLocale(code);
              }}
              hitSlop={6}
            >
              <Text style={code === locale ? styles.langOn : styles.langOff}>{code.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.sync}>
          {offline ? `${t.offline} · ` : ""}
          {pending > 0 ? `${t.pending}: ${pending} · ` : ""}
          {t.lastSync}: {syncedAt ? bakuTimeLabel(syncedAt) : t.neverSynced}
        </Text>
        {batteryPct !== null ? (
          <Text
            style={[
              styles.battery,
              batteryPct <= 20 ? styles.batteryLow : null,
            ]}
          >
            {batteryPct}%
          </Text>
        ) : null}
        {token ? (
          <Pressable onPress={() => void onLogout()} hitSlop={8}>
            <Text style={styles.logout}>{t.logout}</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>
      <Pressable style={styles.secret} onPress={onSecretTap} />
      {kioskPaused ? (
        <View style={styles.kioskPausedBar}>
          <Text style={styles.kioskPausedText}>{t.kioskPaused}</Text>
          <View style={styles.adminRow}>
            <Pressable style={styles.adminBtn} onPress={() => openDesktop()}>
              <Text style={styles.adminBtnText}>{t.adminDesktop}</Text>
            </Pressable>
            <Pressable style={styles.adminBtn} onPress={() => openSettings()}>
              <Text style={styles.adminBtnText}>{t.adminSettings}</Text>
            </Pressable>
            <Pressable style={styles.adminBtn} onPress={() => openWifi()}>
              <Text style={styles.adminBtnText}>{t.adminWifi}</Text>
            </Pressable>
          </View>
          <Pressable style={styles.signIn} onPress={onResumeKiosk}>
            <Text style={styles.signInText}>{t.kioskResume}</Text>
          </Pressable>
        </View>
      ) : null}
      {!ready ? (
        <View style={styles.login}>
          <ActivityIndicator color="#2980B9" />
          {bootError ? <Text style={styles.loginError}>{t.startFailed}: {bootError}</Text> : null}
        </View>
      ) : !token ? (
        <View style={styles.login}>
          {bootError ? (
            <>
              <Text style={styles.loginError}>{t.startFailed}: {bootError}</Text>
              <Pressable style={styles.signIn} onPress={() => setBootNonce((n) => n + 1)}>
                <Text style={styles.signInText}>{t.retry}</Text>
              </Pressable>
            </>
          ) : null}
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t.login}
            value={loginName}
            onChangeText={setLoginName}
          />
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder={t.password}
            value={password}
            onChangeText={setPassword}
          />
          {showOrgNo ? (
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              placeholder={t.orgNo}
              value={orgNo}
              onChangeText={setOrgNo}
            />
          ) : null}
          {loginError ? <Text style={styles.loginError}>{loginError}</Text> : null}
          <Pressable style={styles.signIn} disabled={signingIn} onPress={() => void onLogin()}>
            <Text style={styles.signInText}>{t.signIn}</Text>
          </Pressable>
        </View>
      ) : mineUnlinked ? (
        <Text style={styles.unlinked}>{t.mineUnlinked}</Text>
      ) : (
        <View style={styles.board}>
        <Board
          orders={orders}
          date={date}
          dayEndHour={dayEndHour}
          now={now}
          isToday={date === todayBakuYmd()}
          t={t}
          busy={busy}
          onCheckIn={(id) => void onCheckIn(id)}
        />
        </View>
      )}
      {pinOpen ? (
        <View style={styles.pinLayer}>
          <View style={styles.pinCard}>
            <Text style={styles.pinTitle}>{t.pinTitle}</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              keyboardType="number-pad"
              placeholder={t.pinHint}
              value={pin}
              onChangeText={setPin}
            />
            {pinError ? <Text style={styles.loginError}>{pinError}</Text> : null}
            <Pressable style={styles.signIn} onPress={submitPin}>
              <Text style={styles.signInText}>{t.pinTitle}</Text>
            </Pressable>
            <Pressable onPress={() => setPinOpen(false)}>
              <Text style={styles.logout}>{t.close}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

async function checkUpdates() {
  nativeLog("NurseApp", "checkUpdates begin");
  try {
    if (!__DEV__) {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    }
  } catch {
    // No EAS project yet, or the device is offline.
  }
  if (!UPDATE_URL) return;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(`${UPDATE_URL}/version.json`, {
      signal: ctrl.signal,
      headers: { "Cache-Control": "no-store" },
    });
    clearTimeout(timer);
    if (!res.ok) {
      nativeLog("NurseApp", `version.json http=${res.status}`);
      return;
    }
    const body = (await res.json()) as { versionCode?: number; apkUrl?: string };
    const current = Number(Application.nativeBuildVersion || 0);
    nativeLog(
      "NurseApp",
      `version.json remote=${body.versionCode ?? "?"} local=${current}`,
    );
    if (body.versionCode && body.apkUrl && body.versionCode > current) {
      nativeLog("NurseApp", `installUpdate ${body.apkUrl}`);
      await installUpdate(body.apkUrl);
    }
  } catch (err) {
    nativeLog(
      "NurseApp",
      `checkUpdates failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F7F8" },
  board: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    // Keep a small strip for the secret 5-tap exit zone.
    paddingRight: 56,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#D5DADF",
  },
  headerText: { fontSize: 18, fontWeight: "700", color: "#34495E" },
  langs: { flexDirection: "row", gap: 8 },
  langOn: { fontSize: 14, fontWeight: "800", color: "#2980B9" },
  langOff: { fontSize: 14, fontWeight: "600", color: "#94A3B8" },
  sync: { flex: 1, fontSize: 12, color: "#64748B" },
  battery: { fontSize: 14, fontWeight: "700", color: "#34495E", minWidth: 44, textAlign: "right" },
  batteryLow: { color: "#C0392B" },
  logout: { color: "#2980B9", fontWeight: "700", fontSize: 14 },
  secret: { position: "absolute", top: 0, right: 0, width: 48, height: 48, zIndex: 5 },
  kioskPausedBar: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    gap: 8,
  },
  kioskPausedText: { color: "#92400E", fontWeight: "600", fontSize: 14 },
  adminRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  adminBtn: {
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  adminBtnText: { color: "#92400E", fontWeight: "700", fontSize: 14 },
  loader: { marginTop: 48 },
  login: { maxWidth: 420, alignSelf: "center", width: "100%", padding: 24, gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#D5DADF",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#34495E",
  },
  signIn: { backgroundColor: "#2980B9", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  signInText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  loginError: { color: "#C0392B" },
  unlinked: { margin: 24, fontSize: 16, color: "#34495E" },
  pinLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  pinCard: {
    width: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  pinTitle: { fontSize: 18, fontWeight: "700", color: "#34495E" },
});
