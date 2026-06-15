/** CBAR official rate publication status (era-data-hub / finance mirror). */
export type CbarRateStatus = "PRELIMINARY" | "FINAL";

export type FxRatePoint = {
  currencyCode: string;
  rate: number;
  rateDate: string;
  value?: number;
  nominal?: number;
  status?: CbarRateStatus;
};

export type FxRateQuery = {
  date?: string;
  symbols?: string[];
};

export type FxRatesResponse = {
  meta?: Record<string, unknown>;
  rates: FxRatePoint[];
};

export type FxRatesRangeResponse = {
  meta?: Record<string, unknown>;
  symbol: string;
  points: Array<{
    rateDate: string;
    rate: number;
    value?: number;
    nominal?: number;
  }>;
};

export type FxConvertResult = {
  meta?: Record<string, unknown>;
  from: string;
  to: string;
  amount: number;
  result: number;
  rateDate?: string;
  isFallback?: boolean;
};
