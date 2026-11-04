import { describe, expect, it } from "vitest";
import { canTransition } from "../src/lib/incident-lifecycle";

describe("Production incident lifecycle rules", () => {
  it("allows Open to Investigating", () => {
    expect(canTransition("open", "investigating")).toBe(true);
  });

  it("allows Investigating to Mitigating", () => {
    expect(canTransition("investigating", "mitigating")).toBe(true);
  });

  it("allows Mitigating to Resolved", () => {
    expect(canTransition("mitigating", "resolved")).toBe(true);
  });

  it("allows reopening a resolved incident", () => {
    expect(canTransition("resolved", "investigating")).toBe(true);
  });

  it("rejects Open directly to Resolved", () => {
    expect(canTransition("open", "resolved")).toBe(false);
  });

  it("rejects invalid backward transitions", () => {
    expect(canTransition("mitigating", "open")).toBe(false);
  });

  it("rejects transitioning to the same status", () => {
    expect(canTransition("open", "open")).toBe(false);
    expect(canTransition("resolved", "resolved")).toBe(false);
  });
});
