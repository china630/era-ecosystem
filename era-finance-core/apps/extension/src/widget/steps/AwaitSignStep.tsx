import type { CSSProperties } from "react";

const card: CSSProperties = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#fff",
  padding: 12,
  fontSize: 13,
};

/**
 * Wave 7: extension NEVER clicks İmzala — user must sign in the portal session.
 */
export function AwaitSignStep(props: { t: (k: string) => string }) {
  return (
    <div style={card}>
      <p style={{ fontWeight: 600, margin: 0 }}>{props.t("extension.widget.stepSign")}</p>
      <p style={{ marginTop: 8, color: "#475569", marginBottom: 0 }}>
        {props.t("extension.widget.awaitSignHint")}
      </p>
      <p
        style={{
          marginTop: 8,
          marginBottom: 0,
          color: "#b45309",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        ERA does not click İmzala / Sign — complete signing yourself in emas.sosial.gov.az.
      </p>
    </div>
  );
}
