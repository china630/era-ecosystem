import { Text, View } from "react-native";
import { EmergencyCard } from "../chrome";
import type { Copy, Phase } from "../copy";
import { MrzCameraFrame } from "../mrz-camera";
import { parseGuestMrz } from "../mrz-parse";
import type { Brand, CareRow, TripPack } from "../types";
import { INK, OK, DANGER, space } from "../theme";
import {
  Card,
  EmptyState,
  ErrorText,
  Field,
  GhostButton,
  ListRow,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "../ui";
import { AuthPanel } from "./AuthPanel";

export function TodayScreen(props: {
  copy: Copy;
  color: string;
  brand: Brand | null;
  trip: TripPack | null;
  unlocked: boolean;
  phase: Phase;
  offers: string[];
  nextProcedure: CareRow | null;
  onOpenTrip: () => void;
  onOpenCare: () => void;
  onOpenHotel: () => void;
  onRefreshTrip: () => void;
  // auth
  code: string;
  setCode: (v: string) => void;
  onExchange: () => void;
  linkError: string | null;
  authChannel: "SMS" | "WHATSAPP" | "EMAIL";
  setAuthChannel: (v: "SMS" | "WHATSAPP" | "EMAIL") => void;
  phone: string;
  setPhone: (v: string) => void;
  otp: string;
  setOtp: (v: string) => void;
  onStartOtp: () => void;
  onVerifyOtp: () => void;
  confNo: string;
  setConfNo: (v: string) => void;
  confSurname: string;
  setConfSurname: (v: string) => void;
  confArrival: string;
  setConfArrival: (v: string) => void;
  onConfirm: () => void;
  authMsg: string | null;
  limited: Record<string, unknown> | null;
  // questionnaire
  qFirst: string;
  setQFirst: (v: string) => void;
  qLast: string;
  setQLast: (v: string) => void;
  qPassport: string;
  setQPassport: (v: string) => void;
  qBirth: string;
  setQBirth: (v: string) => void;
  qNationality: string;
  setQNationality: (v: string) => void;
  qSex: string;
  setQSex: (v: string) => void;
  mrzText: string;
  setMrzText: (v: string) => void;
  mrzOk: boolean;
  setMrzOk: (v: boolean) => void;
  onSaveQuestionnaire: () => void;
  qMsg: string | null;
}) {
  const { copy, color, trip, unlocked, phase } = props;

  if (!trip || !unlocked) {
    return (
      <AuthPanel
        copy={copy}
        color={color}
        code={props.code}
        setCode={props.setCode}
        onExchange={props.onExchange}
        linkError={props.linkError}
        authChannel={props.authChannel}
        setAuthChannel={props.setAuthChannel}
        phone={props.phone}
        setPhone={props.setPhone}
        otp={props.otp}
        setOtp={props.setOtp}
        onStartOtp={props.onStartOtp}
        onVerifyOtp={props.onVerifyOtp}
        confNo={props.confNo}
        setConfNo={props.setConfNo}
        confSurname={props.confSurname}
        setConfSurname={props.setConfSurname}
        confArrival={props.confArrival}
        setConfArrival={props.setConfArrival}
        onConfirm={props.onConfirm}
        authMsg={props.authMsg}
        limited={props.limited}
      />
    );
  }

  return (
    <View>
      <Card>
        <Text style={{ color: INK, fontWeight: "700", fontSize: 18 }}>{copy.comingCard}</Text>
        <Text style={{ color: INK, marginTop: 6, fontSize: 16 }}>{trip.hotel.name}</Text>
        {trip.hotel.address ? <Muted>{trip.hotel.address}</Muted> : null}
        <Text style={{ color: INK, marginTop: 8 }}>
          {(trip.checkIn ?? "—").slice(0, 10)} → {(trip.checkOut ?? "—").slice(0, 10)}
        </Text>
        <View
          style={{
            alignSelf: "flex-start",
            marginTop: space.sm,
            backgroundColor: "#E8F2EF",
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: color, fontWeight: "700", fontSize: 12 }}>
            {copy.phaseBadge}: {copy.phases[phase]}
          </Text>
        </View>
        <GhostButton label={copy.refresh} color={color} onPress={props.onRefreshTrip} />
      </Card>

      <EmergencyCard
        copy={copy}
        deskPhone={props.brand?.deskPhone}
        doctorPhone={props.brand?.doctorOnDutyPhone}
      />

      {phase === "in_house" ? (
        <Card>
          <SectionTitle>{copy.nextUp}</SectionTitle>
          {props.nextProcedure ? (
            <ListRow
              title={props.nextProcedure.procedureName ?? "—"}
              subtitle={props.nextProcedure.scheduledAt?.replace("T", " ").slice(0, 16)}
              meta={props.nextProcedure.room ?? undefined}
            />
          ) : (
            <Muted>{copy.careEmpty}</Muted>
          )}
          <GhostButton label={copy.openCare} color={color} onPress={props.onOpenCare} />
          <GhostButton label={copy.openTrip} color={color} onPress={props.onOpenTrip} />
        </Card>
      ) : null}

      {phase === "before" ? (
        <Card>
          <SectionTitle>{copy.qTitle}</SectionTitle>
          <Muted>{copy.qHint}</Muted>
          <Field value={props.qFirst} onChangeText={props.setQFirst} placeholder={copy.qFirst} />
          <Field value={props.qLast} onChangeText={props.setQLast} placeholder={copy.qLast} />
          <Field
            value={props.qPassport}
            onChangeText={props.setQPassport}
            placeholder={copy.qPassport}
          />
          <Text style={{ marginTop: space.sm, fontWeight: "700", color: INK }}>{copy.mrzTitle}</Text>
          <MrzCameraFrame
            color={color}
            labels={{
              open: copy.mrzCameraOpen,
              close: copy.mrzCameraClose,
              hint: copy.mrzCameraHint,
            }}
            onCaptured={(doc) => {
              props.setMrzOk(true);
              props.setQPassport(doc.documentNumber);
              if (doc.firstName) props.setQFirst(doc.firstName);
              if (doc.lastName) props.setQLast(doc.lastName);
              if (doc.birthDate) props.setQBirth(doc.birthDate);
              if (doc.nationality) props.setQNationality(doc.nationality);
              if (doc.sex) props.setQSex(doc.sex);
            }}
          />
          <View
            style={{
              borderWidth: 3,
              borderColor: props.mrzOk ? OK : DANGER,
              borderRadius: 12,
              padding: space.sm,
              marginTop: space.sm,
            }}
          >
            <Text style={{ fontWeight: "600", color: props.mrzOk ? OK : DANGER }}>
              {props.mrzOk ? copy.mrzGreen : copy.mrzRed}
            </Text>
            <Field
              value={props.mrzText}
              editable={!props.mrzOk}
              multiline
              style={{ minHeight: 64 }}
              placeholder={copy.mrzHint}
              onChangeText={(v) => {
                props.setMrzText(v);
                const doc = parseGuestMrz(v);
                const ok = Boolean(doc?.checksOk);
                props.setMrzOk(ok);
                if (ok && doc) {
                  props.setQPassport(doc.documentNumber);
                  if (doc.firstName) props.setQFirst(doc.firstName);
                  if (doc.lastName) props.setQLast(doc.lastName);
                  if (doc.birthDate) props.setQBirth(doc.birthDate);
                  if (doc.nationality) props.setQNationality(doc.nationality);
                  if (doc.sex) props.setQSex(doc.sex);
                }
              }}
            />
          </View>
          <PrimaryButton label={copy.qSave} color={color} onPress={props.onSaveQuestionnaire} />
          {props.qMsg ? (
            props.qMsg === copy.qFail ? (
              <ErrorText>{props.qMsg}</ErrorText>
            ) : (
              <Muted>{props.qMsg}</Muted>
            )
          ) : null}
          <GhostButton label={copy.openTrip} color={color} onPress={props.onOpenTrip} />
        </Card>
      ) : null}

      {phase === "after" ? (
        <Card>
          <SectionTitle>{copy.offersTitle}</SectionTitle>
          {props.brand?.postStayMessage ? (
            <Text style={{ color: INK, marginBottom: 8 }}>{props.brand.postStayMessage}</Text>
          ) : null}
          {props.offers.length === 0 ? (
            <EmptyState title={copy.hotelEmpty} />
          ) : (
            props.offers.map((o) => <ListRow key={o} title={o} />)
          )}
          <GhostButton label={copy.openHotel} color={color} onPress={props.onOpenHotel} />
        </Card>
      ) : null}
    </View>
  );
}
