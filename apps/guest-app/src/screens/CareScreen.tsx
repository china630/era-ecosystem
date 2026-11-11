import { Text, View } from "react-native";
import type { Copy } from "../copy";
import type { CareRow, TripPack } from "../types";
import { INK } from "../theme";
import { Card, EmptyState, GhostButton, ListRow, Muted, SectionTitle } from "../ui";

function fmtWhen(iso?: string) {
  if (!iso) return "";
  return iso.replace("T", " ").slice(0, 16);
}

export function CareScreen(props: {
  copy: Copy;
  color: string;
  token: string | null;
  trip: TripPack | null;
  careLoadedAt: string | null;
  careHint: string | null;
  timetable: CareRow[];
  results: CareRow[];
  episodes: CareRow[];
  familyMsg: string | null;
  onLinkFamily: (id: string) => void;
}) {
  const { copy } = props;

  if (!props.token) {
    return <EmptyState title={copy.careLocked} body={copy.needLink} />;
  }

  return (
    <View>
      {props.careLoadedAt ? (
        <Muted>
          {copy.staleStamp}: {props.careLoadedAt.slice(0, 19).replace("T", " ")}
        </Muted>
      ) : null}

      {props.careHint ? (
        <Card>
          <Text style={{ color: INK, fontWeight: "600" }}>
            {copy.careReason}: {props.careHint}
          </Text>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>{copy.careTimetable}</SectionTitle>
        {props.timetable.length === 0 ? <Muted>{copy.careEmpty}</Muted> : null}
        {props.timetable.map((row) => (
          <ListRow
            key={row.id}
            title={row.procedureName ?? "—"}
            subtitle={fmtWhen(row.scheduledAt)}
            meta={row.room ?? row.status}
          />
        ))}
      </Card>

      <Card>
        <SectionTitle>{copy.careResults}</SectionTitle>
        {props.results.length === 0 ? <Muted>{copy.careEmpty}</Muted> : null}
        {props.results.map((row) => (
          <ListRow key={row.id} title={row.title ?? row.id} />
        ))}
      </Card>

      <Card>
        <SectionTitle>{copy.careEpisodes}</SectionTitle>
        {props.episodes.length === 0 ? <Muted>{copy.careEmpty}</Muted> : null}
        {props.episodes.map((row) => (
          <ListRow key={row.id} title={row.label ?? row.id} />
        ))}
      </Card>

      {props.trip ? (
        <Card>
          <SectionTitle>{copy.familyTitle}</SectionTitle>
          <Muted>{copy.familyHint}</Muted>
          {props.trip.party
            .filter((p) => p.id && p.id !== props.trip!.reservationGuestId)
            .map((p) => (
              <GhostButton
                key={p.id}
                color={props.color}
                label={`${copy.familyLink}: ${[p.firstName, p.lastName].filter(Boolean).join(" ") || p.id}`}
                onPress={() => props.onLinkFamily(String(p.id))}
              />
            ))}
          {props.familyMsg ? <Muted>{props.familyMsg}</Muted> : null}
        </Card>
      ) : null}
    </View>
  );
}
