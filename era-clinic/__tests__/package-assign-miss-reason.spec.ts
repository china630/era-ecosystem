jest.mock("@era/satellite-kit/ui", () => ({
  showApiError: jest.fn(),
  showSuccess: jest.fn(),
}));

import { isPackageAssignNoonHold, packageAssignMissReasonText } from "@/lib/package-assign-toasts";
import { packageAssignBlockText } from "@/lib/package-assign-block";

describe("package assign failure text", () => {
  it("names anamnesis instead of a missing day", () => {
    const keys: string[] = [];
    const text = packageAssignMissReasonText("anamnesis", (key) => {
      keys.push(key);
      return key;
    });
    expect(keys).toEqual(["packageAssignMissAnamnesis"]);
    expect(text).toBe("packageAssignMissAnamnesis");
  });

  it("names same_day instead of a missing day", () => {
    const keys: string[] = [];
    const text = packageAssignMissReasonText("same_day", (key) => {
      keys.push(key);
      return key;
    });
    expect(keys).toEqual(["packageAssignMissSameDay"]);
    expect(text).toBe("packageAssignMissSameDay");
  });

  it("prefers busy copy when the attempt cap or time budget stopped the hunt", () => {
    const keys: string[] = [];
    const text = packageAssignMissReasonText(
      "no_slot",
      (key) => {
        keys.push(key);
        return key;
      },
      { hitAttemptCap: true },
    );
    expect(keys).toEqual(["packageAssignMissBusy"]);
    expect(text).toBe("packageAssignMissBusy");
  });

  it("does not treat attempt-cap no_slot as checkout-morning hold", () => {
    expect(isPackageAssignNoonHold({ reason: "no_slot", hitAttemptCap: true })).toBe(false);
  });

  it("shows the instantiate error instead of the template hint", () => {
    const text = packageAssignBlockText(
      (key) => key,
      "INSTANTIATE_FAILED",
      "PKG-DERMA",
      { message: "Stay nights 13 below package minimum 14" },
    );
    expect(text).toBe("Stay nights 13 below package minimum 14");
  });
});
