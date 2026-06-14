import { z } from "zod";
import { satelliteEventBaseSchema } from "../events/common";

export const INVOICE_GL_POSTED = "INVOICE_GL_POSTED" as const;

export const invoiceGlPostedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(INVOICE_GL_POSTED),
  payload: z.object({
    invoiceId: z.string().min(1),
    sourceId: z.string().optional(),
    sourceType: z.string().optional(),
    amount: z.number(),
    currency: z.literal("AZN"),
    glTransactionId: z.string().optional(),
    postedAt: z.string().min(1),
  }),
});

export type InvoiceGlPostedEvent = z.infer<typeof invoiceGlPostedSchema>;

export function isInvoiceGlPosted(data: unknown): data is InvoiceGlPostedEvent {
  return invoiceGlPostedSchema.safeParse(data).success;
}
