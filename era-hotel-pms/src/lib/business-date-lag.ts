/** Arrival is already on the wall calendar, but night audit has not reached that day. */
export class BusinessDateLagError extends Error {
  readonly code = "BUSINESS_DATE_LAG";
  readonly businessDate: string;
  readonly arrivalDate: string;

  constructor(businessDate: string, arrivalDate: string) {
    super(
      `Night audit is still on ${businessDate}. Close it before check-in on ${arrivalDate}.`,
    );
    this.name = "BusinessDateLagError";
    this.businessDate = businessDate;
    this.arrivalDate = arrivalDate;
  }
}
