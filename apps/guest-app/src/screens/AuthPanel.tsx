import { Text, View } from "react-native";
import type { Copy } from "../copy";
import { INK, space } from "../theme";
import { Card, Chip, ErrorText, Field, Muted, PrimaryButton, SectionTitle } from "../ui";

export function AuthPanel({
  copy,
  color,
  code,
  setCode,
  onExchange,
  linkError,
  authChannel,
  setAuthChannel,
  phone,
  setPhone,
  otp,
  setOtp,
  onStartOtp,
  onVerifyOtp,
  confNo,
  setConfNo,
  confSurname,
  setConfSurname,
  confArrival,
  setConfArrival,
  onConfirm,
  authMsg,
  limited,
}: {
  copy: Copy;
  color: string;
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
}) {
  return (
    <View>
      <Card>
        <Muted>{copy.needLink}</Muted>
      </Card>

      <Card>
        <SectionTitle>{copy.linkTitle}</SectionTitle>
        <Muted>{copy.linkHint}</Muted>
        <Field
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          keyboardType="number-pad"
        />
        <PrimaryButton label={copy.linkAction} color={color} onPress={onExchange} />
        {linkError ? <ErrorText>{linkError}</ErrorText> : null}
      </Card>

      <Card>
        <SectionTitle>{copy.phoneAuthTitle}</SectionTitle>
        <Muted>{copy.phoneAuthHint}</Muted>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space.sm }}>
          {(
            [
              ["SMS", copy.channelSms],
              ["WHATSAPP", copy.channelWa],
              ["EMAIL", copy.channelEmail],
            ] as const
          ).map(([ch, label]) => (
            <Chip
              key={ch}
              label={label}
              active={authChannel === ch}
              onPress={() => setAuthChannel(ch)}
            />
          ))}
        </View>
        <Field value={phone} onChangeText={setPhone} placeholder="+994…" keyboardType="phone-pad" />
        <Field value={otp} onChangeText={setOtp} placeholder="OTP" keyboardType="number-pad" />
        <PrimaryButton label={copy.phoneAuthSend} color={color} onPress={onStartOtp} />
        <PrimaryButton label={copy.phoneAuthVerify} color={color} onPress={onVerifyOtp} />
      </Card>

      <Card>
        <SectionTitle>{copy.confirmTitle}</SectionTitle>
        <Muted>{copy.confirmHint}</Muted>
        <Field value={confNo} onChangeText={setConfNo} placeholder="ResNo" />
        <Field value={confSurname} onChangeText={setConfSurname} placeholder="Surname" />
        <Field value={confArrival} onChangeText={setConfArrival} placeholder="YYYY-MM-DD" />
        <PrimaryButton label={copy.confirmAction} color={color} onPress={onConfirm} />
        {authMsg ? <Text style={{ color: INK, marginTop: 8 }}>{authMsg}</Text> : null}
        {limited ? (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: "600", color: INK }}>{copy.limitedPack}</Text>
            <Muted>
              {[
                typeof limited.confirmation === "string" ? limited.confirmation : null,
                typeof limited.status === "string" ? limited.status : null,
                typeof limited.checkIn === "string" ? String(limited.checkIn).slice(0, 10) : null,
                typeof limited.checkOut === "string" ? String(limited.checkOut).slice(0, 10) : null,
              ]
                .filter(Boolean)
                .join(" · ") || copy.confirmHint}
            </Muted>
            {limited.careLocked === true ? <Muted>{copy.careLocked}</Muted> : null}
          </View>
        ) : null}
      </Card>
    </View>
  );
}
