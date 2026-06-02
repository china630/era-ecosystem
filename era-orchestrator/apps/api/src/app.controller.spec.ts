import { AppController } from "./app.controller";

describe("AppController", () => {
  it("health returns orchestrator status", () => {
    const controller = new AppController();
    expect(controller.health()).toEqual({
      status: "ok",
      service: "era-orchestrator",
    });
  });
});
