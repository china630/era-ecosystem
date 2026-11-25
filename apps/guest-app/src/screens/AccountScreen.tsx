import { Text, View } from "react-native";
import type { Copy } from "../copy";
import type { GuestLocale } from "../trip-store";
import { INK, space } from "../theme";
import { Card, Chip, GhostButton, Muted, PrimaryButton, SectionTitle } from "../ui";
import { AuthPanel } from "./AuthPanel";

export function AccountScreen(props: {
  copy: Copy;
  color: string;
  linked: boolean;
  locale: GuestLocale;
  onLocale: (locale: GuestLocale) => void;
  muteMarketing: boolean;
  onToggleMute: () => void;
  onLogout: () => void;
  onBack: () => void;
  // auth (shown when not linked)
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
  const { copy, color } = props;

  return (
    <View>
      <GhostButton label={copy.back} color={color} onPress={props.onBack} />

      <Card>
        <SectionTitle>{copy.accountTitle}</SectionTitle>
        <Muted>{props.linked ? copy.accountLinked : copy.accountGuest}</Muted>
      </Card>

      <Card>
        <SectionTitle>{copy.languageTitle}</SectionTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space.sm }}>
          {(
            [
              ["az", "AZ"],
              ["ru", "RU"],
              ["en", "EN"],
            ] as const
          ).map(([code, label]) => (
            <Chip
              key={code}
              label={label}
              active={props.locale === code}
              onPress={() => props.onLocale(code)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>{copy.settingsTitle}</SectionTitle>
        <GhostButton
          label={props.muteMarketing ? copy.marketingMute : copy.marketingOn}
          color={color}
          onPress={props.onToggleMute}
        />
      </Card>

      {!props.linked ? (
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
      ) : (
        <Card>
          <Text style={{ color: INK, marginBottom: 8 }}>{copy.accountLinked}</Text>
          <PrimaryButton label={copy.logout} color={color} onPress={props.onLogout} />
        </Card>
      )}
    </View>
  );
}
