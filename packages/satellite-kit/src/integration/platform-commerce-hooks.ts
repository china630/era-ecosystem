import {
  createBookingAppointment,
  createBookingSlot,
  createCustomDomain,
  createPaymentLink,
  createPortalLink,
  createPromotion,
  createShipment,
  type PlatformCallOptions,
} from "./control-plane-platform.client";
import {
  fetchSubscriptionSnapshot,
  moduleEnabled,
  type PlatformModuleKey,
} from "./platform-hook-policy";

export type PlatformCommerceHooksInput = {
  organizationId: string;
  snapshot?: Record<string, unknown> | null;
  portal?: { entityType: string; entityId: string; extra?: Record<string, unknown> };
  payment?: {
    amountAzn: number;
    sourceEntityType: string;
    sourceEntityId: string;
    description?: string;
  };
  bookingSlot?: Record<string, unknown>;
  bookingAppointment?: Record<string, unknown>;
  loyalty?: {
    code: string;
    name: string;
    discountValue?: number;
    metadata?: Record<string, unknown>;
  };
  delivery?: {
    sourceEntityType: string;
    sourceEntityId: string;
    externalRef?: string;
    recipientPhone?: string;
  };
  domain?: { hostname: string; metadata?: Record<string, unknown> };
};

export async function runPlatformCommerceHooks(
  input: PlatformCommerceHooksInput,
  opts?: PlatformCallOptions,
): Promise<{ payUrl?: string }> {
  const organizationId = input.organizationId?.trim();
  if (!organizationId) return {};

  const callOpts = { organizationId, ...opts };
  const snapshot =
    input.snapshot ?? (await fetchSubscriptionSnapshot(organizationId, callOpts));

  let payUrl: string | undefined;

  if (
    input.payment &&
    moduleEnabled(snapshot, "platform_payments", { allowWhenNoSnapshot: true })
  ) {
    try {
      const link = (await createPaymentLink(
        {
          amountAzn: input.payment.amountAzn,
          sourceEntityType: input.payment.sourceEntityType,
          sourceEntityId: input.payment.sourceEntityId,
          description: input.payment.description,
        },
        callOpts,
      )) as { paymentUrl?: string; portalPayUrl?: string };
      payUrl = link.paymentUrl ?? link.portalPayUrl;
    } catch {
      payUrl = undefined;
    }
  }

  if (input.portal && moduleEnabled(snapshot, "platform_portal")) {
    try {
      await createPortalLink(
        {
          entityType: input.portal.entityType,
          entityId: input.portal.entityId,
          ...input.portal.extra,
        },
        callOpts,
      );
    } catch {
      // optional
    }
  }

  if (input.delivery && moduleEnabled(snapshot, "platform_delivery")) {
    try {
      await createShipment(
        {
          sourceEntityType: input.delivery.sourceEntityType,
          sourceEntityId: input.delivery.sourceEntityId,
          externalRef: input.delivery.externalRef,
          recipientPhone: input.delivery.recipientPhone,
        },
        callOpts,
      );
    } catch {
      // optional
    }
  }

  if (input.loyalty && moduleEnabled(snapshot, "platform_loyalty")) {
    try {
      await createPromotion(
        {
          code: input.loyalty.code,
          name: input.loyalty.name,
          discountType: "PERCENT",
          discountValue: input.loyalty.discountValue ?? 5,
          metadata: input.loyalty.metadata,
        },
        callOpts,
      );
    } catch {
      // optional
    }
  }

  if (input.domain && moduleEnabled(snapshot, "platform_domain")) {
    try {
      await createCustomDomain(
        {
          hostname: input.domain.hostname,
          metadata: input.domain.metadata,
        },
        callOpts,
      );
    } catch {
      // optional
    }
  }

  if (input.bookingSlot && moduleEnabled(snapshot, "platform_booking")) {
    try {
      await createBookingSlot(input.bookingSlot, callOpts);
    } catch {
      // optional
    }
  }

  if (input.bookingAppointment && moduleEnabled(snapshot, "platform_booking")) {
    try {
      await createBookingAppointment(input.bookingAppointment, callOpts);
    } catch {
      // optional
    }
  }

  return { payUrl };
}

export function isModuleActive(
  snapshot: Record<string, unknown> | null,
  key: PlatformModuleKey,
): boolean {
  return moduleEnabled(snapshot, key);
}
