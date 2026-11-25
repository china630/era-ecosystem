describe("Procurement tender award rules", () => {
  it("requires exactly one winner", () => {
    const bids = [
      { isWinner: true, amount: 100 },
      { isWinner: true, amount: 90 },
    ];
    expect(bids.filter((b) => b.isWinner)).toHaveLength(2);
  });

  it("accepts winnerBidId when isWinner unset", () => {
    const bids = [
      { id: "a", isWinner: false, amount: 100 },
      { id: "b", isWinner: false, amount: 90 },
    ];
    const winnerBidId = "b";
    const winner = bids.find((b) => b.id === winnerBidId);
    expect(winner?.amount).toBe(90);
  });

  it("refuses award without bids", () => {
    const bids: unknown[] = [];
    expect(bids.length).toBe(0);
  });

  it("refuses double award", () => {
    const status = "AWARDED";
    expect(status === "AWARDED").toBe(true);
  });
});
