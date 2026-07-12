import { Module } from "@nestjs/common";
import { FxController } from "./fx/fx.controller";
import { FxService } from "./fx/fx.service";
import { BanksController } from "./banks/banks.controller";
import { BanksService } from "./banks/banks.service";
import { CompaniesController } from "./companies/companies.controller";
import { CompaniesService } from "./companies/companies.service";
import { HsController } from "./hs/hs.controller";
import { HsService } from "./hs/hs.service";
import { GeoController } from "./geo/geo.controller";
import { GeoService } from "./geo/geo.service";
import { UomController } from "./uom/uom.controller";
import { UomService } from "./uom/uom.service";
import { CurrenciesController } from "./currencies/currencies.controller";
import { CurrenciesService } from "./currencies/currencies.service";
import { TaxRatesController } from "./tax-rates/tax-rates.controller";
import { TaxRatesService } from "./tax-rates/tax-rates.service";
import { ChartOfAccountsController } from "./chart-of-accounts/chart-of-accounts.controller";
import { ChartOfAccountsService } from "./chart-of-accounts/chart-of-accounts.service";
import { CalendarController } from "./calendar/calendar.controller";
import { CalendarService } from "./calendar/calendar.service";
import { IbanController } from "./iban/iban.controller";
import { IbanService } from "./iban/iban.service";
import { AuthModule } from "../auth/auth.module";
import { IngestModule } from "../ingest/ingest.module";

@Module({
  imports: [AuthModule, IngestModule],
  controllers: [
    FxController,
    BanksController,
    CompaniesController,
    HsController,
    GeoController,
    UomController,
    CurrenciesController,
    TaxRatesController,
    ChartOfAccountsController,
    CalendarController,
    IbanController,
  ],
  providers: [
    FxService,
    BanksService,
    CompaniesService,
    HsService,
    GeoService,
    UomService,
    CurrenciesService,
    TaxRatesService,
    ChartOfAccountsService,
    CalendarService,
    IbanService,
  ],
})
export class RegistryModule {}
