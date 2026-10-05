import { CLINIC_PRESET } from "@/domain/presets/clinic-presets";
import { buildClinicNav, CLINIC_NAV } from "@/domain/nav/clinic-nav";
import { CLINIC_PERMISSION, DEFAULT_ROLE_PERMISSIONS } from "@/lib/auth/clinic-permissions";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { hasPresetInList, pathnameRequiresPreset } from "@/domain/presets/preset-cookie";

type NavHrefNode = { href?: string; children?: NavHrefNode[] };

function visibleHrefs(nav: {
  topItems: NavHrefNode[];
  sections: { items: NavHrefNode[] }[];
}): string[] {
  const walk = (items: NavHrefNode[]): string[] =>
    items.flatMap((item) => [
      ...(item.href ? [item.href] : []),
      ...walk(item.children ?? []),
    ]);
  return [...walk(nav.topItems), ...nav.sections.flatMap((section) => walk(section.items))];
}

function hrefs(enabled: string[]) {
  const nav = buildClinicNav(
    {
      permissions: DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.CLINIC_ADMIN],
      presetEnabled: (code) => enabled.includes(code),
    },
    (key) => key,
  );
  return visibleHrefs(nav);
}

describe("clinic nav presets", () => {
  it("sanatorium shows the doctor matrix and hides the hospital and polyclinic desks", () => {
    const links = hrefs([CLINIC_PRESET.SANATORIUM_CLINICAL]);
    expect(links).toContain("/appointments");
    expect(links).toContain("/sanatorium");
    expect(links).toContain("/nurse");
    expect(links).toContain("/admin/program-templates");
    expect(links).toContain("/admin/access");
    expect(links).toContain("/admin/users");
    expect(links).toContain("/admin/logins");
    expect(links).not.toContain("/reception/queue");
    expect(links).not.toContain("/cashier");
    expect(links).not.toContain("/doctor");
    expect(links).not.toContain("/inpatient");
    expect(links).not.toContain("/admin/wards");
  });

  it("outpatient hides sanatorium and inpatient modules", () => {
    const links = hrefs([CLINIC_PRESET.OUTPATIENT]);
    expect(links).toContain("/appointments");
    expect(links).toContain("/reception/queue");
    expect(links).toContain("/doctor");
    expect(links).not.toContain("/sanatorium");
    expect(links).not.toContain("/nurse");
    expect(links).not.toContain("/inpatient");
  });

  it("inpatient is the ward desk only", () => {
    const links = hrefs([CLINIC_PRESET.INPATIENT_DAY]);
    expect(links).toContain("/inpatient");
    expect(links).toContain("/patients");
    expect(links).not.toContain("/appointments");
    expect(links).not.toContain("/sanatorium");
  });

  it("middleware blocks the hospital path unless inpatient_day is on", () => {
    expect(pathnameRequiresPreset("/admin/wards")).toEqual([CLINIC_PRESET.INPATIENT_DAY]);
    expect(pathnameRequiresPreset("/inpatient/census")).toEqual([CLINIC_PRESET.INPATIENT_DAY]);
    expect(
      hasPresetInList([CLINIC_PRESET.SANATORIUM_CLINICAL], pathnameRequiresPreset("/inpatient")!),
    ).toBe(false);
    expect(
      hasPresetInList(
        [CLINIC_PRESET.SANATORIUM_CLINICAL],
        pathnameRequiresPreset("/appointments")!,
      ),
    ).toBe(true);
  });

  it("every nav preset code is a known preset", () => {
    const walk = (entries: typeof CLINIC_NAV): void => {
      for (const entry of entries) {
        for (const code of entry.preset ?? []) {
          expect(Object.values(CLINIC_PRESET)).toContain(code);
        }
        if (entry.children) walk(entry.children);
      }
    };
    walk(CLINIC_NAV);
    expect(CLINIC_PERMISSION.SCREEN_INPATIENT).toBe("screen:inpatient");
  });
});
