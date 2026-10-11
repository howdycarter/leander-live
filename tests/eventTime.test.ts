import { describe, expect, it } from "vitest";
import { formatTime, inRange, parseLeanderTime, toLocalInputValue } from "../src/lib/eventTime";

describe("Leander civil time", () => {
  it("keeps Sunday in the current weekend", () => {
    const now = new Date("2026-10-11T12:00:00-05:00");
    expect(inRange(Date.parse("2026-10-11T18:00:00-05:00"), "This Weekend", now)).toBe(true);
    expect(inRange(Date.parse("2026-10-17T12:00:00-05:00"), "This Weekend", now)).toBe(false);
  });
  it("handles the 25-hour fall-back weekend", () => {
    const now = new Date("2026-10-30T12:00:00-05:00");
    expect(inRange(Date.parse("2026-11-01T23:30:00-06:00"), "This Weekend", now)).toBe(true);
    expect(inRange(Date.parse("2026-11-02T00:00:00-06:00"), "This Weekend", now)).toBe(false);
  });
  it("uses Central time at a UTC date boundary", () => {
    expect(inRange(Date.parse("2026-10-12T02:00:00Z"), "Today", new Date("2026-10-11T23:00:00Z"))).toBe(true);
    expect(formatTime(Date.parse("2026-10-11T23:00:00Z"))).toContain("6:00");
  });
  it("parses normal local times and rejects DST gaps/ambiguity", () => {
    expect(parseLeanderTime("2026-10-17T08:00")).toBe(Date.parse("2026-10-17T08:00:00-05:00"));
    expect(toLocalInputValue(new Date("2026-10-17T13:00:00Z"))).toBe("2026-10-17T08:00");
    expect(() => parseLeanderTime("2026-03-08T02:30")).toThrow();
    expect(() => parseLeanderTime("2026-11-01T01:30")).toThrow();
    expect(() => parseLeanderTime("2026-02-30T10:00")).toThrow();
  });
});
