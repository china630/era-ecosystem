import { useEffect, useState } from "react";
import { AppState, ScrollView, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { unlockCachedTripWithBiometrics } from "./src/biometrics";
import { scheduleLeadAlerts } from "./src/care-alarm";
import { AppHeader, TabBar } from "./src/chrome";
import { COPY, type Phase, type TabId } from "./src/copy";
import { AccountScreen } from "./src/screens/AccountScreen";
import { BellScreen } from "./src/screens/BellScreen";
import { CareScreen } from "./src/screens/CareScreen";
import { HotelScreen } from "./src/screens/HotelScreen";
import { TodayScreen } from "./src/screens/TodayScreen";
import { TripScreen } from "./src/screens/TripScreen";
import { BG, NEUTRAL, space } from "./src/theme";
import {
  orderKindsFromBrand,
  type BoardInfo,
  type BookingRow,
  type Brand,
  type CareRow,
  type FolioRow,
  type LaundryItemRow,
  type LaundryTicketRow,
  type MsgRow,
  type OrderRow,
  type TourBookingRow,
  type TourDepartureRow,
  type TransferRow,
} from "./src/types";
import {
  clearSession,
  enqueueOrder,
  loadCareSlice,
  loadCatalogSnapshot,
  loadLocale,
  loadMuteMarketing,
  loadOrderQueue,
  loadSession,
  phaseFromTrip,
  saveCareSlice,
  saveCatalogSnapshot,
  saveLocale,
  saveOrderQueue,
  saveSession,
  setMuteMarketing,
  type GuestLocale,
  type QueuedOrder,
  type TripPack,
} from "./src/trip-store";

type Overlay = "none" | "bell" | "account";

const ORG =
  process.env.EXPO_PUBLIC_ORGANIZATION_ID || "6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b";
const ORCH = process.env.EXPO_PUBLIC_ORCH_URL || "https://app.era-365.online";
const HOTEL = process.env.EXPO_PUBLIC_HOTEL_URL || "https://hotel-pms.era-365.online";

export default function App() {
  return (
    <SafeAreaProvider>
      <GuestAppShell />
    </SafeAreaProvider>
  );
}

function GuestAppShell() {
  const insets = useSafeAreaInsets();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [phase, setPhase] = useState<Phase>("before");
  const [tab, setTab] = useState<TabId>("today");
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [trip, setTrip] = useState<TripPack | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [qFirst, setQFirst] = useState("");
  const [qLast, setQLast] = useState("");
  const [qPassport, setQPassport] = useState("");
  const [qBirth, setQBirth] = useState("");
  const [qNationality, setQNationality] = useState("");
  const [qSex, setQSex] = useState("");
  const [qMsg, setQMsg] = useState<string | null>(null);
  const [mrzText, setMrzText] = useState("");
  const [mrzOk, setMrzOk] = useState(false);
  const [bookIn, setBookIn] = useState("");
  const [bookOut, setBookOut] = useState("");
  const [bookAdults, setBookAdults] = useState("2");
  const [bookMsg, setBookMsg] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [queued, setQueued] = useState<QueuedOrder[]>([]);
  const [orderKind, setOrderKind] = useState("HOUSEKEEPING");
  const [timetable, setTimetable] = useState<CareRow[]>([]);
  const [results, setResults] = useState<CareRow[]>([]);
  const [episodes, setEpisodes] = useState<CareRow[]>([]);
  const [careHint, setCareHint] = useState<string | null>(null);
  const [careLoadedAt, setCareLoadedAt] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [authChannel, setAuthChannel] = useState<"SMS" | "WHATSAPP" | "EMAIL">("SMS");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [confNo, setConfNo] = useState("");
  const [confSurname, setConfSurname] = useState("");
  const [confArrival, setConfArrival] = useState("");
  const [limited, setLimited] = useState<Record<string, unknown> | null>(null);
  const [muteMarketing, setMuteMarketingState] = useState(false);
  const [familyMsg, setFamilyMsg] = useState<string | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [folio, setFolio] = useState<FolioRow[]>([]);
  const [board, setBoard] = useState<BoardInfo | null>(null);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [laundryItems, setLaundryItems] = useState<LaundryItemRow[]>([]);
  const [laundryTickets, setLaundryTickets] = useState<LaundryTicketRow[]>([]);
  const [tours, setTours] = useState<TourDepartureRow[]>([]);
  const [tourBookings, setTourBookings] = useState<TourBookingRow[]>([]);
  const [catalogLoadedAt, setCatalogLoadedAt] = useState<string | null>(null);
  const [queueMsg, setQueueMsg] = useState<string | null>(null);
  const [localeOverride, setLocaleOverride] = useState<GuestLocale | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const existing = await loadSession();
      const mute = await loadMuteMarketing();
      const savedLocale = await loadLocale();
      const care = await loadCareSlice();
      const catalog = await loadCatalogSnapshot();
      const q = await loadOrderQueue();
      if (cancelled) return;
      setMuteMarketingState(mute);
      if (savedLocale) setLocaleOverride(savedLocale);
      setQueued(q);
      if (care) {
        setTimetable(care.timetable);
        setResults(care.results);
        setEpisodes(care.episodes);
        setCareLoadedAt(care.loadedAt);
        if (care.reason) setCareHint(care.reason);
      }
      if (catalog) setCatalogLoadedAt(catalog.loadedAt);
      if (!existing.trip || !existing.token) return;
      const ok = await unlockCachedTripWithBiometrics();
      if (cancelled || !ok) return;
      setUnlocked(true);
      setTrip(existing.trip);
      setToken(existing.token);
      setLoadedAt(existing.trip.loadedAt);
      setPhase(phaseFromTrip(existing.trip));
    })();
    if (!ORG) {
      return () => {
        cancelled = true;
      };
    }
    fetch(`${ORCH}/platform/v1/guest-app/${ORG}/brand`)
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data: Brand | null) => {
        if (cancelled || !data?.enabled) return;
        setBrand(data);
        const kinds = orderKindsFromBrand(data);
        setOrderKind((prev) => (kinds.includes(prev) ? prev : kinds[0] ?? "HOUSEKEEPING"));
        const catalog = Array.isArray(data.catalogJson) ? (data.catalogJson as string[]) : [];
        const offers = Array.isArray(data.offersJson) ? (data.offersJson as string[]) : [];
        const snap = { loadedAt: new Date().toISOString(), catalog, offers };
        await saveCatalogSnapshot(snap);
        if (!cancelled) setCatalogLoadedAt(snap.loadedAt);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const lang: GuestLocale = localeOverride ?? brand?.locale ?? "en";
  const copy = COPY[lang];
  const color = brand?.primaryColor ?? NEUTRAL;
  const title = brand?.displayName ?? copy.brandMissing;
  const leadMinutes = (brand?.leadAlertMinutes === 5 ? 5 : 10) as 5 | 10;

  async function setLang(next: GuestLocale) {
    setLocaleOverride(next);
    await saveLocale(next);
  }

  async function exchange() {
    setLinkError(null);
    const trimmed = code.trim().replace(/\s+/g, "");
    if (!trimmed) {
      setLinkError(copy.linkFail);
      return;
    }
    try {
      const res = await fetch(`${HOTEL}/api/guest-app/exchange`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: ORG, code: trimmed }),
      });
      if (!res.ok) {
        setLinkError(`${copy.linkFail} (${res.status})`);
        return;
      }
      const data = (await res.json()) as { token: string; trip: TripPack };
      await saveSession(data.token, data.trip);
      setUnlocked(true);
      setToken(data.token);
      setTrip(data.trip);
      setLoadedAt(data.trip.loadedAt);
      setPhase(phaseFromTrip(data.trip));
      setOverlay("none");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network";
      setLinkError(`${copy.linkFail} · ${msg}`);
    }
  }

  async function refreshTrip() {
    if (!token) return;
    try {
      const res = await fetch(`${HOTEL}/api/guest-app/trip`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const next = (await res.json()) as TripPack;
      await saveSession(token, next);
      setTrip(next);
      setLoadedAt(next.loadedAt);
      setPhase(phaseFromTrip(next));
    } catch {
      /* keep cached trip */
    }
  }

  async function saveQuestionnaire() {
    if (!token) return;
    setQMsg(null);
    try {
      const res = await fetch(`${HOTEL}/api/guest-app/questionnaire`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: qFirst,
          lastName: qLast,
          passportNo: qPassport,
          birthDate: qBirth || undefined,
          nationality: qNationality || undefined,
          sex: qSex || undefined,
        }),
      });
      setQMsg(res.ok ? copy.qSaved : copy.qFail);
    } catch {
      setQMsg(copy.qFail);
    }
  }

  async function sendBooking() {
    setBookMsg(null);
    try {
      const res = await fetch(`${HOTEL}/api/guest-app/booking-requests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          organizationId: ORG,
          checkIn: bookIn,
          checkOut: bookOut,
          adults: Number(bookAdults) || 1,
          children: 0,
        }),
      });
      setBookMsg(res.ok ? copy.bookingOk : copy.bookingFail);
      if (res.ok) void loadBookings();
    } catch {
      setBookMsg(copy.bookingFail);
    }
  }

  async function loadBookings() {
    try {
      const res = await fetch(
        `${HOTEL}/api/guest-app/booking-requests?organizationId=${encodeURIComponent(ORG)}`,
        { headers: token ? { authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { items: BookingRow[] };
      setBookings(data.items);
    } catch {
      /* hotel Nest offline — keep empty list */
    }
  }

  async function placeOrderOnline() {
    if (!token) return;
    try {
      const res = await fetch(`${HOTEL}/api/guest-app/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ kind: orderKind, queuedOffline: false }),
      });
      if (res.ok) void loadOrders();
    } catch {
      setQueueMsg(copy.queueError);
    }
  }

  async function placeOrderQueued() {
    const row = await enqueueOrder(orderKind);
    setQueued(await loadOrderQueue());
    setQueueMsg(`${copy.orderQueue}: ${row.localId}`);
  }

  async function flushOrderQueue() {
    if (!token) return;
    setQueueMsg(copy.queueFlush);
    const items = await loadOrderQueue();
    const remaining: QueuedOrder[] = [];
    for (const item of items) {
      try {
        const res = await fetch(`${HOTEL}/api/guest-app/orders`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            kind: item.kind,
            note: item.note,
            queuedOffline: true,
          }),
        });
        if (!res.ok) remaining.push({ ...item, lastError: copy.queueError });
      } catch {
        remaining.push({ ...item, lastError: copy.queueError });
      }
    }
    await saveOrderQueue(remaining);
    setQueued(remaining);
    setQueueMsg(remaining.length ? copy.queueError : null);
    void loadOrders();
  }

  async function loadOrders() {
    if (!token) return;
    try {
      const res = await fetch(`${HOTEL}/api/guest-app/orders`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items: OrderRow[] };
      setOrders(data.items);
    } catch {
      /* offline */
    }
  }

  async function loadFolioBoard() {
    if (!token) return;
    try {
      const headers = { authorization: `Bearer ${token}` };
      const [f, b] = await Promise.all([
        fetch(`${HOTEL}/api/guest-app/folio`, { headers }),
        fetch(`${HOTEL}/api/guest-app/board`, { headers }),
      ]);
      if (f.ok) {
        const data = (await f.json()) as { folios: FolioRow[] };
        setFolio(data.folios ?? []);
      }
      if (b.ok) setBoard((await b.json()) as BoardInfo);
    } catch {
      /* offline */
    }
  }

  async function loadStayServices() {
    if (!token) return;
    const headers = { authorization: `Bearer ${token}` };
    try {
      const [tr, laundry, tour] = await Promise.all([
        fetch(`${HOTEL}/api/guest-app/transfers`, { headers }),
        fetch(`${HOTEL}/api/guest-app/laundry`, { headers }),
        fetch(`${HOTEL}/api/guest-app/tours`, { headers }),
      ]);
      if (tr.ok) {
        const data = (await tr.json()) as { items: TransferRow[] };
        setTransfers(data.items ?? []);
      }
      if (laundry.ok) {
        const data = (await laundry.json()) as {
          items: LaundryItemRow[];
          tickets: LaundryTicketRow[];
        };
        setLaundryItems(data.items ?? []);
        setLaundryTickets(data.tickets ?? []);
      }
      if (tour.ok) {
        const data = (await tour.json()) as {
          departures: TourDepartureRow[];
          bookings: TourBookingRow[];
        };
        setTours(data.departures ?? []);
        setTourBookings(data.bookings ?? []);
      }
    } catch {
      /* offline */
    }
  }

  async function washOne(itemId: string) {
    if (!token) return;
    try {
      await fetch(`${HOTEL}/api/guest-app/laundry`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, washQty: 1, ironQty: 0 }),
      });
      void loadStayServices();
    } catch {
      /* keep list */
    }
  }

  async function bookTour(departureId: string) {
    if (!token) return;
    try {
      await fetch(`${HOTEL}/api/guest-app/tours`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ departureId }),
      });
      void loadStayServices();
    } catch {
      /* keep list */
    }
  }

  async function loadMessages() {
    if (!token) return;
    try {
      const res = await fetch(`${HOTEL}/api/guest-app/messages`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items: MsgRow[] };
      setMessages(data.items);
    } catch {
      /* offline */
    }
  }

  async function markRead(id: string) {
    if (!token) return;
    try {
      await fetch(`${HOTEL}/api/guest-app/messages/${id}/read`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}` },
      });
      void loadMessages();
    } catch {
      /* offline */
    }
  }

  async function linkFamily(granteeGuestId: string) {
    if (!token) return;
    setFamilyMsg(null);
    try {
      const res = await fetch(`${HOTEL}/api/guest-app/family-grants`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ granteeGuestId }),
      });
      setFamilyMsg(res.ok ? copy.familyOk : copy.familyFail);
    } catch {
      setFamilyMsg(copy.familyFail);
    }
  }

  async function loadCare() {
    if (!token) {
      setCareHint(copy.careLocked);
      return;
    }
    setCareHint(null);
    const headers = { authorization: `Bearer ${token}` };
    try {
      const [tt, rr, ee] = await Promise.all([
        fetch(`${HOTEL}/api/guest-app/care/timetable`, { headers }),
        fetch(`${HOTEL}/api/guest-app/care/results`, { headers }),
        fetch(`${HOTEL}/api/guest-app/care/episodes`, { headers }),
      ]);
      let reason: string | null = null;
      let ttItems: CareRow[] = [];
      let rrItems: CareRow[] = [];
      let eeItems: CareRow[] = [];
      if (tt.ok) {
        const data = (await tt.json()) as {
          items: Array<{
            id: string;
            scheduledAt: string;
            procedureName: string;
            room: string | null;
            status: string;
          }>;
          reason?: string;
        };
        ttItems = data.items;
        setTimetable(data.items);
        void scheduleLeadAlerts({
          rows: data.items.map((r) => ({
            id: r.id,
            scheduledAt: r.scheduledAt,
            procedureName: r.procedureName,
            room: r.room,
            status: r.status,
          })),
          leadMinutes,
          mode: "lead",
        });
        if (data.items.length === 0) reason = data.reason ?? copy.careEmpty;
      }
      if (rr.ok) {
        rrItems = ((await rr.json()) as { items: CareRow[] }).items;
        setResults(rrItems);
      }
      if (ee.ok) {
        eeItems = ((await ee.json()) as { items: CareRow[] }).items;
        setEpisodes(eeItems);
      }
      if (reason) setCareHint(reason);
      const loaded = new Date().toISOString();
      setCareLoadedAt(loaded);
      await saveCareSlice({
        loadedAt: loaded,
        reason,
        timetable: ttItems as never,
        results: rrItems,
        episodes: eeItems,
      });
    } catch {
      const cached = await loadCareSlice();
      if (cached) {
        setTimetable(cached.timetable);
        setResults(cached.results);
        setEpisodes(cached.episodes);
        setCareLoadedAt(cached.loadedAt);
        setCareHint(cached.reason ?? copy.careEmpty);
      }
    }
  }

  async function startOtp() {
    setAuthMsg(null);
    try {
      const res = await fetch(`${HOTEL}/api/guest-app/auth/phone/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: ORG,
          channel: authChannel,
          destination: phone,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { stubCode?: string };
      if (!res.ok) {
        setAuthMsg(copy.linkFail);
        return;
      }
      if (data.stubCode) setOtp(data.stubCode);
      setAuthMsg(copy.phoneAuthSend);
    } catch {
      setAuthMsg(copy.linkFail);
    }
  }

  async function verifyOtp() {
    try {
      const res = await fetch(`${HOTEL}/api/guest-app/auth/phone/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: ORG,
          channel: authChannel,
          destination: phone,
          code: otp,
        }),
      });
      if (!res.ok) {
        setAuthMsg(copy.linkFail);
        return;
      }
      const data = (await res.json()) as { token: string };
      setToken(data.token);
      setUnlocked(true);
      const tripRes = await fetch(`${HOTEL}/api/guest-app/trip`, {
        headers: { authorization: `Bearer ${data.token}` },
      });
      if (tripRes.ok) {
        const next = (await tripRes.json()) as TripPack;
        await saveSession(data.token, next);
        setTrip(next);
        setLoadedAt(next.loadedAt);
        setPhase(phaseFromTrip(next));
      }
      setAuthMsg(copy.phoneAuthOk);
    } catch {
      setAuthMsg(copy.linkFail);
    }
  }

  async function openConfirmation() {
    try {
      const res = await fetch(`${HOTEL}/api/guest-app/auth/confirmation`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: ORG,
          confirmation: confNo,
          surname: confSurname,
          arrivalYmd: confArrival,
        }),
      });
      if (!res.ok) {
        setAuthMsg(copy.linkFail);
        return;
      }
      setLimited((await res.json()) as Record<string, unknown>);
    } catch {
      setAuthMsg(copy.linkFail);
    }
  }

  useEffect(() => {
    if (tab === "today" && token) {
      void loadFolioBoard();
      void loadStayServices();
    }
    if (tab === "trip") {
      void loadBookings();
      if (token) {
        void loadOrders();
        void loadFolioBoard();
        void loadStayServices();
        void flushOrderQueue();
      }
    }
    if (tab === "care") void loadCare();
  }, [tab, token]);

  useEffect(() => {
    if (overlay === "bell" && token) void loadMessages();
  }, [overlay, token]);

  async function logout() {
    await clearSession();
    setToken(null);
    setTrip(null);
    setUnlocked(false);
    setLoadedAt(null);
    setLimited(null);
    setOverlay("account");
  }

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && token) void flushOrderQueue();
    });
    return () => sub.remove();
  }, [token]);

  // Keep phase aligned to trip dates (no manual phase toggles).
  useEffect(() => {
    if (trip && unlocked) setPhase(phaseFromTrip(trip));
  }, [trip, unlocked]);

  const catalog = Array.isArray(brand?.catalogJson) ? (brand?.catalogJson as string[]) : [];
  const offers = Array.isArray(brand?.offersJson) ? (brand?.offersJson as string[]) : [];
  const visibleMessages = messages.filter((m) => !(muteMarketing && m.kind === "MARKETING"));
  const nextProcedure =
    timetable
      .filter((r) => r.scheduledAt && new Date(r.scheduledAt).getTime() >= Date.now())
      .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))[0] ?? null;

  const linked = Boolean(trip && unlocked);
  const unread = visibleMessages.some((m) => !m.readAt);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />
      <AppHeader
        title={
          overlay === "account"
            ? copy.accountTitle
            : overlay === "bell"
              ? copy.bellTitle
              : title
        }
        color={color}
        logoUrl={brand?.logoUrl}
        linked={linked}
        unread={unread}
        overlay={overlay}
        backLabel={copy.back}
        onBack={() => setOverlay("none")}
        onAccount={() => setOverlay((v) => (v === "account" ? "none" : "account"))}
        onBell={() => setOverlay((v) => (v === "bell" ? "none" : "bell"))}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: space.md,
          paddingBottom: 24,
        }}
      >
        {overlay === "bell" ? (
          <BellScreen
            copy={copy}
            color={color}
            messages={visibleMessages}
            muteMarketing={muteMarketing}
            onToggleMute={() => {
              void (async () => {
                const next = !muteMarketing;
                setMuteMarketingState(next);
                await setMuteMarketing(next);
              })();
            }}
            onMarkRead={(id) => void markRead(id)}
            onBack={() => setOverlay("none")}
          />
        ) : null}

        {overlay === "account" ? (
          <AccountScreen
            copy={copy}
            color={color}
            linked={linked}
            locale={lang}
            onLocale={(next) => void setLang(next)}
            muteMarketing={muteMarketing}
            onToggleMute={() => {
              void (async () => {
                const next = !muteMarketing;
                setMuteMarketingState(next);
                await setMuteMarketing(next);
              })();
            }}
            onLogout={() => void logout()}
            onBack={() => setOverlay("none")}
            code={code}
            setCode={setCode}
            onExchange={() => void exchange()}
            linkError={linkError}
            authChannel={authChannel}
            setAuthChannel={setAuthChannel}
            phone={phone}
            setPhone={setPhone}
            otp={otp}
            setOtp={setOtp}
            onStartOtp={() => void startOtp()}
            onVerifyOtp={() => void verifyOtp()}
            confNo={confNo}
            setConfNo={setConfNo}
            confSurname={confSurname}
            setConfSurname={setConfSurname}
            confArrival={confArrival}
            setConfArrival={setConfArrival}
            onConfirm={() => void openConfirmation()}
            authMsg={authMsg}
            limited={limited}
          />
        ) : null}

        {overlay === "none" && tab === "today" ? (
          <TodayScreen
            copy={copy}
            color={color}
            brand={brand}
            trip={trip}
            unlocked={unlocked}
            phase={phase}
            offers={offers}
            nextProcedure={nextProcedure}
            board={board}
            folio={folio}
            transfers={transfers}
            onOpenTrip={() => setTab("trip")}
            onOpenCare={() => setTab("care")}
            onOpenHotel={() => setTab("hotel")}
            onOpenAccount={() => setOverlay("account")}
            onRefreshTrip={() => void refreshTrip()}
            qFirst={qFirst}
            setQFirst={setQFirst}
            qLast={qLast}
            setQLast={setQLast}
            qPassport={qPassport}
            setQPassport={setQPassport}
            qBirth={qBirth}
            setQBirth={setQBirth}
            qNationality={qNationality}
            setQNationality={setQNationality}
            qSex={qSex}
            setQSex={setQSex}
            mrzText={mrzText}
            setMrzText={setMrzText}
            mrzOk={mrzOk}
            setMrzOk={setMrzOk}
            onSaveQuestionnaire={() => void saveQuestionnaire()}
            qMsg={qMsg}
          />
        ) : null}

        {overlay === "none" && tab === "trip" ? (
          <TripScreen
            copy={copy}
            color={color}
            brand={brand}
            trip={trip}
            unlocked={unlocked}
            bookIn={bookIn}
            setBookIn={setBookIn}
            bookOut={bookOut}
            setBookOut={setBookOut}
            bookAdults={bookAdults}
            setBookAdults={setBookAdults}
            onSendBooking={() => void sendBooking()}
            bookMsg={bookMsg}
            bookings={bookings}
            board={board}
            folio={folio}
            laundryItems={laundryItems}
            laundryTickets={laundryTickets}
            onLaundryWash={(id) => void washOne(id)}
            tours={tours}
            tourBookings={tourBookings}
            onBookTour={(id) => void bookTour(id)}
            orderKind={orderKind}
            setOrderKind={setOrderKind}
            onOrderOnline={() => void placeOrderOnline()}
            onOrderQueued={() => void placeOrderQueued()}
            onFlushQueue={() => void flushOrderQueue()}
            queueMsg={queueMsg}
            queued={queued}
            orders={orders}
          />
        ) : null}

        {overlay === "none" && tab === "care" ? (
          <CareScreen
            copy={copy}
            color={color}
            token={token}
            trip={trip}
            careLoadedAt={careLoadedAt}
            careHint={careHint}
            timetable={timetable}
            results={results}
            episodes={episodes}
            familyMsg={familyMsg}
            onLinkFamily={(id) => void linkFamily(id)}
          />
        ) : null}

        {overlay === "none" && tab === "hotel" ? (
          <HotelScreen
            copy={copy}
            brand={brand}
            catalog={catalog}
            offers={offers}
            catalogLoadedAt={catalogLoadedAt}
          />
        ) : null}
      </ScrollView>
      <TabBar
        copy={copy}
        tab={tab}
        onChange={(id) => {
          setTab(id);
          setOverlay("none");
        }}
      />
    </View>
  );
}
