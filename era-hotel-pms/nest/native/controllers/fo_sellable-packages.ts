/** FO read of active MEDICAL catalog (gate hotel_medical_sanatorium). */
import { Controller, Get, HttpCode, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { serialize } from '@/lib/serialize';
import {
  listActiveMedicalPackageChoices,
  countActiveMedicalPackages,
  listSellablePackages,
} from '@/lib/services/hotel-sellable-package.service';
import { isSanatoriumModuleActive } from '@/lib/sanatorium-module';
import { requestOrganizationId } from '@/lib/request-organization';
import {
  enterHotelStaff,
  hotelNestSession,
  runWithHotelTenant,
  sendJson,
  sendRouteError,
} from '../../bridge';

@Controller()
export class FoSellablePackagesController {
  @Get('api/fo/sellable-packages')
  @HttpCode(200)
  async get(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      await runWithHotelTenant(session, async () => {
        const org = requestOrganizationId();
        const sanatorium = await isSanatoriumModuleActive(org);
        if (!sanatorium) {
          return sendJson(httpRes, {
            sanatorium: false,
            activeMedical: 0,
            medicalChoices: [],
            infoturCodes: [],
          });
        }
        const [medicalChoices, activeMedical, infotur] = await Promise.all([
          listActiveMedicalPackageChoices(),
          countActiveMedicalPackages(),
          listSellablePackages({ family: 'INFOTUR', activeOnly: true }),
        ]);
        return sendJson(
          httpRes,
          serialize({
            sanatorium: true,
            activeMedical,
            medicalChoices,
            infoturCodes: infotur.map((r) => r.code),
          }),
        );
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
