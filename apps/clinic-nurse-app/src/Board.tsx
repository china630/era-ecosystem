import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { bakuTimeLabel } from "./baku";
import type { Copy } from "./copy";
import { placeOrder, type Place } from "./place-order";
import { parseBakuDateTime } from "./baku";
import type { Proc } from "./types";

const CHIP: Record<string, { bg: string; fg: string }> = {
  SCHEDULED: { bg: "rgba(41,128,185,0.12)", fg: "#2980B9" },
  CHECKED_IN: { bg: "rgba(39,174,96,0.12)", fg: "#1E8449" },
  COMPLETED: { bg: "rgba(100,116,139,0.12)", fg: "#334155" },
  NO_SHOW: { bg: "rgba(245,158,11,0.15)", fg: "#92400E" },
  PENDING_PAY: { bg: "rgba(231,76,60,0.12)", fg: "#C0392B" },
};

function timeRange(order: Proc, t: Copy): string {
  const open = order.schedulingMode === "OPEN" && !order.resourceId && !order.resource;
  if (open) return t.openAttendance;
  const start = bakuTimeLabel(order.scheduledAt);
  const endSrc = order.endsAt || order.effectiveEndsAt;
  return endSrc ? `${start}–${bakuTimeLabel(endSrc)}` : start;
}

function cabinOf(order: Proc, t: Copy): string {
  if (order.schedulingMode === "OPEN" && !order.resourceId && !order.resource) {
    return t.openAttendanceCabin;
  }
  return order.resource?.name || order.resource?.code || "—";
}

function Card({
  order,
  t,
  allowCheckIn,
  busy,
  onCheckIn,
  onInfo,
}: {
  order: Proc;
  t: Copy;
  allowCheckIn: boolean;
  busy: boolean;
  onCheckIn: (id: string) => void;
  onInfo: (order: Proc) => void;
}) {
  const chip = CHIP[order.status] ?? { bg: "#F1F5F9", fg: "#334155" };
  const showCheckIn = allowCheckIn && order.status === "SCHEDULED" && order.checkInOpen === true;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardBody}>
          <Text style={styles.timeLine}>
            {timeRange(order, t)}
            {order.clinicalEpisode?.roomNumber?.trim()
              ? `  ·  ${t.colRoom} ${order.clinicalEpisode.roomNumber.trim()}`
              : ""}
          </Text>
          <Text style={styles.patient} numberOfLines={2}>
            {order.patientRef.fullName}
          </Text>
          <Text style={styles.procedure} numberOfLines={2}>
            {order.procedureName}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {t.cabinLabel}: {cabinOf(order, t)}
          </Text>
        </View>
        <View style={styles.cardSide}>
          <Text style={[styles.chip, { backgroundColor: chip.bg, color: chip.fg }]}>
            {t.status[order.status] ?? order.status}
          </Text>
          <Pressable style={styles.info} onPress={() => onInfo(order)} accessibilityRole="button">
            <Text style={styles.infoText}>i</Text>
          </Pressable>
        </View>
      </View>
      {order.status === "PENDING_PAY" ? (
        <Text style={styles.unpaid}>{t.unpaidBlock}</Text>
      ) : null}
      {order.cardError ? <Text style={styles.error}>{order.cardError}</Text> : null}
      {showCheckIn ? (
        <Pressable
          style={[styles.checkIn, busy && styles.disabled]}
          disabled={busy}
          onPress={() => onCheckIn(order.id)}
        >
          <Text style={styles.checkInText}>{t.checkIn}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Board({
  orders,
  date,
  dayEndHour,
  now,
  isToday,
  t,
  busy,
  onCheckIn,
}: {
  orders: Proc[];
  date: string;
  dayEndHour: number;
  now: number;
  isToday: boolean;
  t: Copy;
  busy: boolean;
  onCheckIn: (id: string) => void;
}) {
  const [info, setInfo] = useState<Proc | null>(null);
  const dayEnd = parseBakuDateTime(date, `${String(dayEndHour).padStart(2, "0")}:00`).getTime();
  const buckets = useMemo(() => {
    const grouped: Record<Place, Proc[]> = { queue: [], progress: [], late: [], done: [] };
    for (const order of orders) {
      const place = placeOrder(order, now, dayEnd, isToday);
      if (place) grouped[place].push(order);
    }
    return grouped;
  }, [orders, now, dayEnd, isToday]);

  const columns: Array<{ key: Place; title: string; empty: string; checkIn: boolean }> = [
    { key: "queue", title: t.queueUpcoming, empty: t.queueUpcomingEmpty, checkIn: true },
    { key: "progress", title: t.queueInProgress, empty: t.queueInProgressEmpty, checkIn: false },
    { key: "late", title: t.queueOverdue, empty: t.queueOverdueEmpty, checkIn: false },
    { key: "done", title: t.queueCompleted, empty: t.queueCompletedEmpty, checkIn: false },
  ];
  const instruction = info?.instruction;
  const instructionEmpty =
    !instruction ||
    (!instruction.bodyPart &&
      instruction.sites.length === 0 &&
      !instruction.applyMode &&
      instruction.fields.length === 0 &&
      !instruction.note);

  return (
    <>
      <View style={styles.row}>
        {columns.map((column) => (
          <View key={column.key} style={styles.column}>
            <View style={styles.columnHead}>
              <Text style={styles.columnTitle} numberOfLines={1}>
                {column.title}
              </Text>
              <Text style={styles.columnCount}>{buckets[column.key].length}</Text>
            </View>
            <ScrollView style={styles.columnScroll} contentContainerStyle={styles.columnBody}>
              {buckets[column.key].map((order) => (
                <Card
                  key={order.id}
                  order={order}
                  t={t}
                  allowCheckIn={column.checkIn}
                  busy={busy}
                  onCheckIn={onCheckIn}
                  onInfo={setInfo}
                />
              ))}
              {buckets[column.key].length === 0 ? (
                <Text style={styles.empty}>{column.empty}</Text>
              ) : null}
            </ScrollView>
          </View>
        ))}
      </View>
      <Modal visible={info !== null} transparent animationType="fade" onRequestClose={() => setInfo(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfo(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{t.detailsTitle}</Text>
            {instructionEmpty ? (
              <Text style={styles.meta}>{t.detailsEmpty}</Text>
            ) : (
              <>
                {instruction?.bodyPart ? (
                  <Text style={styles.meta}>
                    {t.detailsBodyPart}: {instruction.bodyPart}
                  </Text>
                ) : null}
                {instruction && instruction.sites.length > 0 ? (
                  <Text style={styles.meta}>
                    {t.detailsSites}: {instruction.sites.join(", ")}
                  </Text>
                ) : null}
                {instruction?.applyMode ? (
                  <Text style={styles.meta}>
                    {t.detailsMode}: {instruction.applyMode}
                  </Text>
                ) : null}
                {instruction && instruction.fields.length > 0 ? (
                  <Text style={styles.meta}>
                    {t.detailsFields}: {instruction.fields.join(" · ")}
                  </Text>
                ) : null}
                {instruction?.note ? (
                  <Text style={styles.meta}>
                    {t.detailsNote}: {instruction.note}
                  </Text>
                ) : null}
              </>
            )}
            <Pressable style={styles.checkIn} onPress={() => setInfo(null)}>
              <Text style={styles.checkInText}>{t.close}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row", gap: 8, padding: 8 },
  column: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D5DADF",
    padding: 8,
  },
  columnHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  columnTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#34495E" },
  columnCount: { fontSize: 18, fontWeight: "700", color: "#2980B9" },
  columnScroll: { flex: 1 },
  columnBody: { paddingBottom: 8 },
  card: {
    backgroundColor: "#FAFBFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  cardTop: { flexDirection: "row", gap: 8 },
  cardBody: { flex: 1, gap: 2 },
  cardSide: { alignItems: "flex-end", gap: 8 },
  timeLine: { fontSize: 16, fontWeight: "700", color: "#2980B9" },
  patient: { fontSize: 18, fontWeight: "700", color: "#34495E" },
  procedure: { fontSize: 16, fontWeight: "600", color: "#34495E" },
  meta: { fontSize: 15, color: "#34495E" },
  chip: { overflow: "hidden", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, fontWeight: "700" },
  info: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D5DADF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: { color: "#2980B9", fontWeight: "700", fontSize: 18 },
  unpaid: {
    backgroundColor: "#E74C3C",
    color: "#FFFFFF",
    textAlign: "center",
    borderRadius: 8,
    paddingVertical: 8,
    fontWeight: "700",
    fontSize: 15,
  },
  error: { color: "#C0392B", fontSize: 14 },
  checkIn: {
    backgroundColor: "#2980B9",
    borderRadius: 10,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  checkInText: { color: "#FFFFFF", fontWeight: "700", fontSize: 18 },
  disabled: { opacity: 0.5 },
  empty: { color: "#64748B", fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 8 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#34495E" },
});
