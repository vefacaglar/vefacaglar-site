import { describe, expect, it } from "vitest";
import { toDecimal, toDigits } from "./numericInput";

describe("toDigits", () => {
  it("keeps only ASCII digits", () => {
    expect(toDigits("123")).toBe("123");
    expect(toDigits("a1b2c3")).toBe("123");
    expect(toDigits("-12.5")).toBe("125");
    expect(toDigits("1 000")).toBe("1000");
  });

  it("drops non-ASCII digits", () => {
    expect(toDigits("١٢٣")).toBe("");
  });

  it("is empty when there are no digits", () => {
    expect(toDigits("")).toBe("");
    expect(toDigits("abc")).toBe("");
  });
});

describe("toDecimal", () => {
  it("keeps digits and a decimal point", () => {
    expect(toDecimal("12.5")).toBe("12.5");
    expect(toDecimal("-3.5h")).toBe("3.5");
  });

  it("treats a comma as the decimal point", () => {
    expect(toDecimal("12,5")).toBe("12.5");
    expect(toDecimal("1 000,5")).toBe("1000.5");
  });

  it("keeps only the first point and drops the rest", () => {
    expect(toDecimal("1.2.3")).toBe("1.23");
    expect(toDecimal("1,2,3")).toBe("1.23");
    expect(toDecimal("1.,2")).toBe("1.2");
  });

  it("keeps leading and trailing points as typed", () => {
    expect(toDecimal(".5")).toBe(".5");
    expect(toDecimal("5.")).toBe("5.");
    expect(toDecimal(".")).toBe(".");
  });

  it("is empty when nothing numeric remains", () => {
    expect(toDecimal("")).toBe("");
    expect(toDecimal("abc")).toBe("");
  });
});
