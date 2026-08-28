export type SpaSaveLine = {
  productId: number;
  serviceName: string;
  price: number;
  quantity?: number;
};

export type SpaSaveInput = {
  hotelId: number;
  depId: number;
  currencyId: number;
  resNameId: number;
  lines: SpaSaveLine[];
};

/** Fat Insert body for `POST /Execute/SP_SPA_SAVE` — extension adds `LoginToken`. */
export function buildSpaSavePayload(input: SpaSaveInput): Record<string, unknown> {
  const quantity = (line: SpaSaveLine) => Math.max(1, line.quantity ?? 1);
  const total = input.lines.reduce((sum, line) => sum + line.price * quantity(line), 0);
  const detailUi = input.lines.map((line) => ({
    ID: line.productId,
    CURRENCY: "AZN",
    CURRID: input.currencyId,
    MAINCURRENCYPRICE: line.price,
    PRICE: line.price,
    PRODUCTGROUPID: null,
    SERVICENAME: line.serviceName,
    searchActive: false,
    TIME: null,
    TYPEID: 3,
    GROUPNAME: null,
    quantity: quantity(line),
    SALESPERSONNELID: null,
    BUYRATE: 1,
    DISCOUNTPERCENT: null,
  }));
  const detailData = input.lines.map((line) => ({
    ID: line.productId,
    QUANTITY: quantity(line),
    PRICE: line.price,
    MAINCURRENCYPRICE: line.price,
    SPID: null,
    DISCOUNTPERCENT: null,
  }));

  return {
    Action: "Execute",
    Object: "SP_SPA_SAVE",
    BaseObject: "SPA_RES",
    Parameters: {
      HOTELID: input.hotelId,
      DEPID: input.depId,
      CURRENCYID: input.currencyId,
      RESNAMEID: input.resNameId,
      POSCARDID: null,
      SPAINHOUSELISTID: null,
      WALKIN: null,
      SPAINHOUSE: null,
      TOTAL: total,
      DETAILDATA: JSON.stringify(detailUi),
      PACKAGEDATA: "[]",
      SALESPERSONNELID: null,
      WALKINROOMNO: null,
      WALKINPHONE: null,
      NATIONALITYID: null,
      CREATENEWCARD: null,
      DISCOUNTGROUPID: null,
      DATA: {
        MASTER: {
          POSCARDID: null,
          RESNAMEID: input.resNameId,
          DEPID: input.depId,
          SALESPERSONNELID: null,
          CREATENEWCARD: null,
        },
        DETAIL: detailData,
      },
    },
  };
}
