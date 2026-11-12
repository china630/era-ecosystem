import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyCheckIn, placeOrder } from "./place-order.ts";

const start = "2026-11-11T06:00:00.000Z";
const deadline = "2026-11-11T06:20:00.000Z";
const nowOpen = new Date("2026-11-11T06:05:00.000Z").getTime();
const nowLate = new Date("2026-11-11T07:00:00.000Z").getTime();
const dayEnd = new Date("2026-11-11T14:00:00.000Z").getTime();
const afterDay = new Date("2026-11-11T15:00:00.000Z").getTime();

describe("placeOrder", () => {
  it("keeps a later scheduled slot in the queue without treating it as late", () => {
    assert.equal(
      placeOrder(
        { status: "SCHEDULED", scheduledAt: start, checkInOpen: false, checkInDeadline: deadline },
        nowOpen,
        dayEnd,
        true,
      ),
      "queue",
    );
  });

  it("puts an open check-in window in the queue", () => {
    assert.equal(
      placeOrder(
        { status: "SCHEDULED", scheduledAt: start, checkInOpen: true, checkInDeadline: deadline },
        nowOpen,
        dayEnd,
        true,
      ),
      "queue",
    );
  });

  it("moves a scheduled row to late after the deadline", () => {
    assert.equal(
      placeOrder(
        { status: "SCHEDULED", scheduledAt: start, checkInOpen: false, checkInDeadline: deadline },
        nowLate,
        dayEnd,
        true,
      ),
      "late",
    );
  });

  it("keeps unpaid in the queue until the deadline, then late", () => {
    assert.equal(
      placeOrder(
        { status: "PENDING_PAY", scheduledAt: start, checkInDeadline: deadline },
        nowOpen,
        dayEnd,
        true,
      ),
      "queue",
    );
    assert.equal(
      placeOrder(
        { status: "PENDING_PAY", scheduledAt: start, checkInDeadline: deadline },
        nowLate,
        dayEnd,
        true,
      ),
      "late",
    );
  });

  it("keeps no-show in late until the clinic day ends", () => {
    assert.equal(
      placeOrder({ status: "NO_SHOW", scheduledAt: start }, nowLate, dayEnd, true),
      "late",
    );
    assert.equal(
      placeOrder({ status: "NO_SHOW", scheduledAt: start }, afterDay, dayEnd, true),
      null,
    );
  });

  it("maps checked-in and completed", () => {
    assert.equal(
      placeOrder({ status: "CHECKED_IN", scheduledAt: start }, nowOpen, dayEnd, true),
      "progress",
    );
    assert.equal(
      placeOrder({ status: "COMPLETED", scheduledAt: start }, nowOpen, dayEnd, true),
      "done",
    );
  });
});

describe("classifyCheckIn", () => {
  it("treats a repeat of a moved row as success", () => {
    assert.equal(classifyCheckIn(400, "INVALID_TRANSITION"), "ok");
    assert.equal(classifyCheckIn(200), "ok");
  });

  it("retries transport failures and stops on a closed window", () => {
    assert.equal(classifyCheckIn(0), "retry");
    assert.equal(classifyCheckIn(503), "retry");
    assert.equal(classifyCheckIn(401), "auth");
    assert.equal(classifyCheckIn(400, "NOT_IN_CHECKIN_WINDOW"), "terminal");
    assert.equal(classifyCheckIn(400, "QR_REQUIRED"), "terminal");
  });
});
