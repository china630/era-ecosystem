import { View } from "react-native";
import type { Copy } from "../copy";
import type { MsgRow } from "../types";
import { Card, EmptyState, GhostButton, ListRow, SectionTitle } from "../ui";

export function BellScreen(props: {
  copy: Copy;
  color: string;
  messages: MsgRow[];
  muteMarketing: boolean;
  onToggleMute: () => void;
  onMarkRead: (id: string) => void;
  onBack: () => void;
}) {
  const { copy } = props;

  return (
    <View>
      <GhostButton label={copy.back} color={props.color} onPress={props.onBack} />
      <Card>
        <SectionTitle>{copy.bellTitle}</SectionTitle>
        <GhostButton
          label={props.muteMarketing ? copy.marketingMute : copy.marketingOn}
          color={props.color}
          onPress={props.onToggleMute}
        />
        {props.messages.length === 0 ? (
          <EmptyState title={copy.bellEmpty} />
        ) : (
          props.messages.map((m) => (
            <ListRow
              key={m.id}
              title={m.body}
              subtitle={m.kind}
              meta={m.createdAt.slice(0, 16).replace("T", " ")}
              unread={!m.readAt}
              onPress={() => props.onMarkRead(m.id)}
            />
          ))
        )}
      </Card>
    </View>
  );
}
