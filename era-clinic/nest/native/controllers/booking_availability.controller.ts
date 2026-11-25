import { Controller, Get, HttpCode, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import { withClinicHttp } from "../../bridge";
import { z } from "zod";
import { addBakuDays, todayBakuYmd } from "@/lib/baku-day";
import { listBookingAvailability } from "@/domain/appointment/booking-availability.service";

const querySchema = z.object({
  practitionerCode: z.string().min(1).max(64).default("GP-01"),
  serviceCode: z.string().max(64).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

@Controller()
export class BookingAvailabilityController {
  @Get("api/booking/availability")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request) {
    return withClinicHttp(httpReq, async () => {
      const enabled = process.env.CLINIC_PUBLIC_BOOKING_ENABLED?.trim();
      if (process.env.NODE_ENV === "production" && enabled !== "true") {
        throw new HttpException({ error: "Public booking disabled" }, 403);
      }

      const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const query = querySchema.parse({
        practitionerCode: url.searchParams.get("practitionerCode") ?? undefined,
        serviceCode: url.searchParams.get("serviceCode") ?? undefined,
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined,
      });

      const fromYmd = query.from ?? todayBakuYmd();
      const toYmd = query.to ?? addBakuDays(fromYmd, 13);
      if (toYmd < fromYmd) {
        throw new HttpException({ error: "Invalid date range" }, 400);
      }

      return listBookingAvailability({
        practitionerCode: query.practitionerCode,
        serviceCode: query.serviceCode,
        fromYmd,
        toYmd,
      });
    });
  }
}