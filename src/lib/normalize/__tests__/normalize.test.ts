import { describe, expect, it } from "vitest";
import { normalizePhone } from "../phone";
import { normalizeCountry } from "../country";
import { normalizeUsState } from "../us-state";

describe("normalizePhone", () => {
  it("formats US numbers to E.164 with the default country", () => {
    expect(normalizePhone("(202) 555-0143")).toBe("+12025550143");
    expect(normalizePhone("202.555.0143", "US")).toBe("+12025550143");
  });
  it("keeps international numbers that already carry a country code", () => {
    expect(normalizePhone("+44 7911 123456", "US")).toBe("+447911123456");
  });
  it("returns null for junk", () => {
    expect(normalizePhone("call me")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("normalizeCountry", () => {
  it("accepts names, codes, and common aliases", () => {
    expect(normalizeCountry("United States")).toBe("US");
    expect(normalizeCountry("us")).toBe("US");
    expect(normalizeCountry("USA")).toBe("US");
    expect(normalizeCountry("United Kingdom")).toBe("GB");
    expect(normalizeCountry("India")).toBe("IN");
  });
  it("returns null for unknown values", () => {
    expect(normalizeCountry("Atlantis")).toBeNull();
    expect(normalizeCountry("  ")).toBeNull();
  });
});

describe("normalizeUsState", () => {
  it("accepts names and codes", () => {
    expect(normalizeUsState("Virginia")).toBe("VA");
    expect(normalizeUsState("va")).toBe("VA");
    expect(normalizeUsState("District of Columbia")).toBe("DC");
    expect(normalizeUsState("Washington DC")).toBe("DC");
  });
  it("returns null for unknown values", () => {
    expect(normalizeUsState("Ontario")).toBeNull();
  });
});
