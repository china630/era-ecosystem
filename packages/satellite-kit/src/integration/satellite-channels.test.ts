import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REVENUE_EVENT_TYPES,
  SatelliteChannelDisabledError,
  assertRevenueEventForPublish,
} from "./satellite-channels.js";

describe("assertRevenueEventForPublish", () => {
  it("includes known money event types", () => {
    assert.equal(REVENUE_EVENT_TYPES.has("SATELLITE_FB_SALE_COMPLETED"), true);
    assert.equal(REVENUE_EVENT_TYPES.has("SATELLITE_RETAIL_SALE_COMPLETED"), true);
    assert.equal(REVENUE_EVENT_TYPES.has("SATELLITE_RETAIL_SHIFT_CLOSED"), true);
    assert.equal(REVENUE_EVENT_TYPES.has("SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED"), true);
    assert.equal(REVENUE_EVENT_TYPES.has("SATELLITE_CLINIC_VISIT_COMPLETED"), true);
  });

  it("unknown event type does not call live check (no throw without orch)", async () => {
    const prevUrl = process.env.ORCHESTRATOR_URL;
    const prevToken = process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    delete process.env.ORCHESTRATOR_URL;
    delete process.env.CONTROL_PLANE_URL;
    delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    delete process.env.CONTROL_PLANE_SERVICE_TOKEN;
    try {
      await assert.doesNotReject(() =>
        assertRevenueEventForPublish({
          organizationId: "org-1",
          fromSatelliteKey: "industry_fnb_pos",
          eventType: "SATELLITE_FB_GUEST_STATUS_CHANGED",
        }),
      );
    } finally {
      if (prevUrl === undefined) delete process.env.ORCHESTRATOR_URL;
      else process.env.ORCHESTRATOR_URL = prevUrl;
      if (prevToken === undefined) delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
      else process.env.SATELLITE_EVENT_SERVICE_TOKEN = prevToken;
    }
  });

  it("money type with missing channel throws SatelliteChannelDisabledError", async () => {
    const prevUrl = process.env.ORCHESTRATOR_URL;
    const prevToken = process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    delete process.env.ORCHESTRATOR_URL;
    delete process.env.CONTROL_PLANE_URL;
    delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    delete process.env.CONTROL_PLANE_SERVICE_TOKEN;
    try {
      await assert.rejects(
        () =>
          assertRevenueEventForPublish({
            organizationId: "org-1",
            fromSatelliteKey: "industry_hotel_pms",
            eventType: "SATELLITE_HOTEL_INVOICE_ISSUED",
          }),
        (err: unknown) =>
          err instanceof SatelliteChannelDisabledError &&
          err.code === "SATELLITE_CHANNEL_DISABLED",
      );
    } finally {
      if (prevUrl === undefined) delete process.env.ORCHESTRATOR_URL;
      else process.env.ORCHESTRATOR_URL = prevUrl;
      if (prevToken === undefined) delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
      else process.env.SATELLITE_EVENT_SERVICE_TOKEN = prevToken;
    }
  });
});
