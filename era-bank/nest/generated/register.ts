import { register as register0 } from "./admin_audit";
import { register as register1 } from "./admin_roles";
import { register as register2 } from "./admin_users";
import { register as register3 } from "./auth_login";
import { register as register4 } from "./auth_logout";
import { register as register5 } from "./auth_me";
import { register as register6 } from "./auth_session_refresh-permissions";
import { register as register7 } from "./auth_sso_exchange";
import { register as register8 } from "./entitlements";
import { register as register9 } from "./health";
import { register as register10 } from "./internal_v1_workforce_roles";
import { register as register11 } from "./mdm_person-lookup";
import { register as register12 } from "./notifications";
import { register as register13 } from "./platform_billing-snapshot";
import { register as register14 } from "./admin_roles__code";
import { register as register15 } from "./admin_roles__code_permissions";

export function registerBankRoutes(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  register0(http);
  register1(http);
  register2(http);
  register3(http);
  register4(http);
  register5(http);
  register6(http);
  register7(http);
  register8(http);
  register9(http);
  register10(http);
  register11(http);
  register12(http);
  register13(http);
  register14(http);
  register15(http);
}
