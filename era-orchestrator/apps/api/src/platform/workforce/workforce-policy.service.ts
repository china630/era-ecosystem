import {

  BadRequestException,

  Injectable,

} from "@nestjs/common";

import { SubscriptionAccessService } from "../../subscription/subscription-access.service";



export type WorkforceHireMode = "cp_workforce" | "disabled";



export type WorkforcePolicyResponse = {

  hireMode: WorkforceHireMode;

  workforceModuleActive: boolean;

  hrModuleActive: boolean;

  satelliteEntitled: boolean;

  absenceWorkflow: "cp";

};



const WORKFORCE_MODULE = "platform_workforce";



@Injectable()

export class WorkforcePolicyService {

  constructor(private readonly subscriptionAccess: SubscriptionAccessService) {}



  async getPolicy(

    organizationId: string,

    satelliteKey: string,

  ): Promise<WorkforcePolicyResponse> {

    const key = satelliteKey.trim();

    const workforceModuleActive = await this.subscriptionAccess.hasModule(

      organizationId,

      WORKFORCE_MODULE,

    );

    const hrModuleActive = await this.subscriptionAccess.hasModule(

      organizationId,

      "hr_full",

    );

    const satelliteEntitled = await this.subscriptionAccess.hasModule(

      organizationId,

      key,

    );



    let hireMode: WorkforceHireMode = "disabled";

    if (workforceModuleActive && satelliteEntitled) {

      hireMode = "cp_workforce";

    }



    return {

      hireMode,

      workforceModuleActive,

      hrModuleActive,

      satelliteEntitled,

      absenceWorkflow: "cp",

    };

  }

}

