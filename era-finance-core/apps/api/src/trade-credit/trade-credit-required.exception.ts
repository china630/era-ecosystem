import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * SKU `trade_credit_control` is off — Payment Required (402), not Forbidden.
 * Distinct from SubscriptionGuard 403 so satellites can prompt unlock.
 */
export class TradeCreditRequiredException extends HttpException {
  constructor(message?: string) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: "TRADE_CREDIT_REQUIRED",
        message:
          message ??
          "Trade credit control module is not enabled for this organization",
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
