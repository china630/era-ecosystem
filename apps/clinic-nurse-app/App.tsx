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
import * as Localization from "expo-localization";
import * as Updates from "expo-updates";
import { fetchBoard, fetchMe, login, loginMeta, logout, postCheckIn } from "./src/api";
import { bakuDateDisplay, bakuTimeLabel, todayBakuYmd } from "./src/baku";
import { Board } from "./src/Board";
import { classifyCheckIn } from "./src/place-order";
import { copyFor, localeFromTag } from "./src/copy";
import {
  clearCardError,
  clearSession,
  enqueueCheckIn,
  loadCardErrors,
  loadOrgNo,
  loadOutbox,
  loadSession,
  loadSnapshot,
  patchOrder,
  removeOutbox,
  saveOrgNo,
  saveSession,
  saveSnapshot,
  setCardError,
} from "./src/store";
import { installUpdate, startKiosk, stopKiosk } from "clinic-nurse-kiosk";
import type { Proc } from "./src/types";

const UPDATE_URL = (process.env.EXPO_PUBLIC_UPDATE_URL ?? "").replace(/\/$/, "");
const KIOSK_PIN = process.env.EXPO_PUBLIC_KIOSK_PIN ?? "";
const SIX_HOURS = 6 * 60 * 60 * 1000;

export default function App() {
  const locale = localeFromTag(Localization.getLocales()[0]?.languageTag);
  const t = copyFor(locale);
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [orgNo, setOrgNo] = useState("");
  const [hostBound, setHostBound] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
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

  useEffect(() => {
    startKiosk();
    void (async () => {
      try {
        const meta = await loginMeta();
        setHostBound(meta.hostBound);
      } catch {
        setHostBound(true);
      }
      setOrgNo(await loadOrgNo());
      const session = await loadSession();
      if (session) {
        tokenRef.current = session.token;
        loginRef.current = session.login;
        setToken(session.token);
        setFullName(session.fullName);
        await paint();
      }
      setReady(true);
      if (session) {
        const me = await fetchMe(session.token);
        if (loginRef.current !== session.login) return;
        if (me.kind === "unauthorized") {
          await dropSession();
        } else if (me.kind === "ok" && me.fullName) {
          setFullName(me.fullName);
          await saveSession(session.token, me.fullName, session.login);
        }
      }
    })();
  }, [dropSession, paint]);

  useEffect(() => {
    if (!token) return;
    void sync();
    const id = setInterval(() => {
      setNow(Date.now());
      setClock(bakuTimeLabel(new Date()));
      void sync();
    }, 30_000);
    const clockId = setInterval(() => {
      setNow(Date.now());
      setClock(bakuTimeLabel(new Date()));
    }, 1000);
    return () => {
      clearInterval(id);
      clearInterval(clockId);
    };
  }, [token, sync]);

  useEffect(() => {
    const check = () => {
      void checkUpdates();
    };
    check();
    const id = setInterval(check, SIX_HOURS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        check();
        void sync();
      }
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [sync]);

  async function onLogin() {
    setSigningIn(true);
    setLoginError(null);
    try {
      const who = loginName.trim();
      const session = await login({
        login: who,
        password,
        orgNo: hostBound ? undefined : orgNo,
      });
      if (!hostBound && orgNo.trim()) await saveOrgNo(orgNo);
      await saveSession(session.token, session.fullName, session.login || who);
      tokenRef.current = session.token;
      loginRef.current = session.login || who;
      blankBoard();
      setFullName(session.fullName);
      setPassword("");
      setToken(session.token);
      await paint();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : t.loginFailed);
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
    stopKiosk();
    setPinOpen(false);
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
        <Text style={styles.sync}>
          {offline ? `${t.offline} · ` : ""}
          {pending > 0 ? `${t.pending}: ${pending} · ` : ""}
          {t.lastSync}: {syncedAt ? bakuTimeLabel(syncedAt) : t.neverSynced}
        </Text>
        {token ? (
          <Pressable onPress={() => void onLogout()} hitSlop={8}>
            <Text style={styles.logout}>{t.logout}</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>
      <Pressable style={styles.secret} onPress={onSecretTap} />
      {!ready ? (
        <ActivityIndicator style={styles.loader} color="#2980B9" />
      ) : !token ? (
        <View style={styles.login}>
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
          {hostBound ? null : (
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              placeholder={t.orgNo}
              value={orgNo}
              onChangeText={setOrgNo}
            />
          )}
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
    const res = await fetch(`${UPDATE_URL}/version.json`);
    if (!res.ok) return;
    const body = (await res.json()) as { versionCode?: number; apkUrl?: string };
    const current = Number(Application.nativeBuildVersion || 0);
    if (body.versionCode && body.apkUrl && body.versionCode > current) {
      await installUpdate(body.apkUrl);
    }
  } catch {
    // The next 6-hour pass retries.
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
    paddingRight: 56,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#D5DADF",
  },
  headerText: { fontSize: 18, fontWeight: "700", color: "#34495E" },
  sync: { flex: 1, fontSize: 12, color: "#64748B" },
  logout: { color: "#2980B9", fontWeight: "700", fontSize: 14 },
  secret: { position: "absolute", top: 0, right: 0, width: 48, height: 48, zIndex: 5 },
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
