import { EarlyAccessEventType, EarlyAccessModuleKey } from "@prisma/client";

describe("EarlyAccess Prisma enums", () => {
  it("exposes nine vertical module keys", () => {
    expect(EarlyAccessModuleKey.RETAIL_ECOM).toBe("RETAIL_ECOM");
    expect(EarlyAccessModuleKey.LOGISTICS_CUSTOMS).toBe("LOGISTICS_CUSTOMS");
    expect(EarlyAccessModuleKey.CONSTRUCTION).toBe("CONSTRUCTION");
    expect(EarlyAccessModuleKey.CRM_WHATSAPP).toBe("CRM_WHATSAPP");
    expect(EarlyAccessModuleKey.AUTO_STO).toBe("AUTO_STO");
    expect(EarlyAccessModuleKey.CLINIC).toBe("CLINIC");
    expect(EarlyAccessModuleKey.WHOLESALE).toBe("WHOLESALE");
    expect(EarlyAccessModuleKey.HOTEL_PMS).toBe("HOTEL_PMS");
    expect(EarlyAccessModuleKey.FB_POS).toBe("FB_POS");
  });

  it("exposes funnel event types", () => {
    expect(EarlyAccessEventType.VIEW_CLICK).toBe("VIEW_CLICK");
    expect(EarlyAccessEventType.SURVEY_SUBMIT).toBe("SURVEY_SUBMIT");
  });
});
