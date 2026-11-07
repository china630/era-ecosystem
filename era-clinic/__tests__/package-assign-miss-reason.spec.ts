jest.mock("@era/satellite-kit/ui", () => ({
  showApiError: jest.fn(),
  showSuccess: jest.fn(),
}));

import { packageAssignMissReasonText } from "@/lib/package-assign-toasts";
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
