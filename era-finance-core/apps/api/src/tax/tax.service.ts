import { Injectable } from "@nestjs/common";
import {
  TaxpayerIntegrationService,
  type TaxpayerLookupResult,
} from "./taxpayer-integration.service";

@Injectable()
export class TaxService {
  constructor(private readonly taxpayerIntegration: TaxpayerIntegrationService) {}

  async lookupTaxpayerByVoen(rawVoen: string): Promise<TaxpayerLookupResult> {
    return this.taxpayerIntegration.lookupTaxpayerByVoen(rawVoen);
  }

  async lookupVatPayerInfo(rawVoen: string) {
    const base = await this.taxpayerIntegration.lookupTaxpayerByVoen(rawVoen);
    return {
      ...base,
      source: "taxpayer-info",
      individualFallbackAvailable: false,
    };
  }
}
