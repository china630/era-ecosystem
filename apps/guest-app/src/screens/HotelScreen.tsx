import { Text, View } from "react-native";
import type { Copy } from "../copy";
import type { Brand } from "../types";
import { INK } from "../theme";
import { Card, EmptyState, ListRow, Muted, SectionTitle } from "../ui";

export function HotelScreen(props: {
  copy: Copy;
  brand: Brand | null;
  catalog: string[];
  offers: string[];
  catalogLoadedAt: string | null;
}) {
  const { copy } = props;

  return (
    <View>
      {props.catalogLoadedAt ? (
        <Muted>
          {copy.staleStamp}: {props.catalogLoadedAt.slice(0, 19).replace("T", " ")}
        </Muted>
      ) : null}

      <Card>
        <SectionTitle>{copy.hotelTitle}</SectionTitle>
        {props.brand?.displayName ? (
          <Text style={{ color: INK, fontWeight: "600", marginBottom: 6 }}>
            {props.brand.displayName}
          </Text>
        ) : null}
        {props.catalog.length === 0 ? (
          <EmptyState title={copy.hotelEmpty} />
        ) : (
          props.catalog.map((c) => <ListRow key={c} title={c} />)
        )}
      </Card>

      <Card>
        <SectionTitle>{copy.offersTitle}</SectionTitle>
        {props.brand?.postStayMessage ? (
          <Text style={{ color: INK, marginBottom: 8 }}>{props.brand.postStayMessage}</Text>
        ) : null}
        {props.offers.length === 0 ? (
          <Muted>{copy.hotelEmpty}</Muted>
        ) : (
          props.offers.map((o) => <ListRow key={o} title={o} />)
        )}
      </Card>
    </View>
  );
}
