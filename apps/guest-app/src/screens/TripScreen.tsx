import { Text, View } from "react-native";
import { EmergencyCard } from "../chrome";
import type { Copy } from "../copy";
import type {
  BoardInfo,
  BookingRow,
  Brand,
  FolioRow,
  OrderRow,
  QueuedOrder,
  TripPack,
} from "../types";
import { orderKindsFromBrand } from "../types";
import { INK } from "../theme";
import {
  Card,
  Chip,
  EmptyState,
  ErrorText,
  Field,
  GhostButton,
  ListRow,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "../ui";

export function TripScreen(props: {
  copy: Copy;
  color: string;
  brand: Brand | null;
  trip: TripPack | null;
  unlocked: boolean;
  bookIn: string;
  setBookIn: (v: string) => void;
  bookOut: string;
  setBookOut: (v: string) => void;
  bookAdults: string;
  setBookAdults: (v: string) => void;
  onSendBooking: () => void;
  bookMsg: string | null;
  bookings: BookingRow[];
  board: BoardInfo | null;
  folio: FolioRow[];
  orderKind: string;
  setOrderKind: (v: string) => void;
  onOrderOnline: () => void;
  onOrderQueued: () => void;
  onFlushQueue: () => void;
  queueMsg: string | null;
  queued: QueuedOrder[];
  orders: OrderRow[];
}) {
  const { copy, color, trip, unlocked } = props;
  const orderKinds = orderKindsFromBrand(props.brand);

  return (
    <View>
      <Card>
        <SectionTitle>{copy.bookingTitle}</SectionTitle>
        <Muted>{copy.bookingHint}</Muted>
        <Field value={props.bookIn} onChangeText={props.setBookIn} placeholder={copy.checkIn} />
        <Field value={props.bookOut} onChangeText={props.setBookOut} placeholder={copy.checkOut} />
        <Field value={props.bookAdults} onChangeText={props.setBookAdults} placeholder={copy.adults} keyboardType="number-pad" />
        <PrimaryButton label={copy.bookingSend} color={color} onPress={props.onSendBooking} />
        {props.bookMsg ? <Muted>{props.bookMsg}</Muted> : null}
        {props.bookings.map((b) => (
          <ListRow
            key={b.id}
            title={`${b.checkIn.slice(0, 10)} → ${b.checkOut.slice(0, 10)}`}
            meta={b.status}
          />
        ))}
      </Card>

      {!trip || !unlocked ? (
        <EmptyState title={copy.needLink} />
      ) : (
        <>
          <Card>
            <SectionTitle>{copy.comingCard}</SectionTitle>
            <Text style={{ color: INK }}>
              {copy.confirmation}: {trip.confirmation ?? "—"}
            </Text>
            <Text style={{ color: INK, marginTop: 4 }}>
              {copy.stayStatus}: {trip.status}
            </Text>
            <SectionTitle>{copy.transfersTitle}</SectionTitle>
            {trip.transfers.length === 0 ? (
              <Muted>{copy.noTransfer}</Muted>
            ) : (
              trip.transfers.map((tr, i) => (
                <ListRow
                  key={`${tr.direction}-${i}`}
                  title={tr.direction}
                  subtitle={[tr.flightNo, tr.pickupAt.replace("T", " ").slice(0, 16)]
                    .filter(Boolean)
                    .join(" · ")}
                  meta={tr.status}
                />
              ))
            )}
          </Card>

          <Card>
            <SectionTitle>{copy.boardTitle}</SectionTitle>
            {props.board ? (
              <>
                <Text style={{ color: INK }}>
                  {props.board.mealPlanCode ?? "—"}
                  {props.board.roomNumber ? ` · ${copy.room} ${props.board.roomNumber}` : ""}
                </Text>
                <Muted>
                  {copy.breakfast}: {props.board.breakfastIncluded ? copy.yes : copy.no} ·{" "}
                  {copy.allInclusive}: {props.board.allInclusive ? copy.yes : copy.no}
                </Muted>
              </>
            ) : (
              <Muted>{copy.boardEmpty}</Muted>
            )}
          </Card>

          <Card>
            <SectionTitle>{copy.folioTitle}</SectionTitle>
            {props.folio.length === 0 ? <Muted>{copy.folioEmpty}</Muted> : null}
            {props.folio.map((f) => (
              <View key={f.id} style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: "700", color: INK }}>
                  {f.settled || !f.open ? copy.folioSettled : copy.folioOpen} · {f.status}
                </Text>
                {f.lines.map((l) => (
                  <ListRow key={l.id} title={l.label} meta={l.amount} />
                ))}
              </View>
            ))}
          </Card>

          <EmergencyCard
            copy={copy}
            deskPhone={props.brand?.deskPhone}
            doctorPhone={props.brand?.doctorOnDutyPhone}
          />

          <Card>
            <SectionTitle>{copy.orderTitle}</SectionTitle>
            <Muted>{copy.orderHint}</Muted>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {orderKinds.map((kind) => (
                <Chip
                  key={kind}
                  label={kind}
                  active={props.orderKind === kind}
                  onPress={() => props.setOrderKind(kind)}
                />
              ))}
            </View>
            <PrimaryButton label={copy.orderSend} color={color} onPress={props.onOrderOnline} />
            <GhostButton label={copy.orderQueue} color={color} onPress={props.onOrderQueued} />
            <GhostButton label={copy.queueFlush} color={color} onPress={props.onFlushQueue} />
            {props.queueMsg ? (
              props.queueMsg === copy.queueError ? (
                <ErrorText>{props.queueMsg}</ErrorText>
              ) : (
                <Muted>{props.queueMsg}</Muted>
              )
            ) : null}
            <Text style={{ marginTop: 10, fontWeight: "600", color: INK }}>{copy.orderQueuedLabel}</Text>
            {props.queued.length === 0 ? <Muted>{copy.queueEmpty}</Muted> : null}
            {props.queued.map((o) => (
              <ListRow
                key={o.localId}
                title={o.kind}
                subtitle={o.lastError ?? "QUEUED"}
                meta={o.createdAt.slice(0, 16).replace("T", " ")}
              />
            ))}
            <Text style={{ marginTop: 10, fontWeight: "600", color: INK }}>{copy.orderHotelLabel}</Text>
            {props.orders.length === 0 ? <Muted>{copy.orderHotelEmpty}</Muted> : null}
            {props.orders.map((o) => (
              <ListRow key={o.id} title={o.kind} meta={o.status} />
            ))}
          </Card>
        </>
      )}
    </View>
  );
}
