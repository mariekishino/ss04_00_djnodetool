// Unit tests for the shared m:ss formatter.

import { describe, it, expect } from "vitest";
import { formatTime } from "./formatTime";

describe("formatTime", () => {
  it("formats zero and sub-minute times with a padded seconds field", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(59)).toBe("0:59");
  });

  it("formats minutes", () => {
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(83)).toBe("1:23");
    expect(formatTime(3599)).toBe("59:59");
  });

  it("truncates fractional seconds rather than rounding up", () => {
    // A 0.9s elapsed time must not display as 0:01 before that second passes.
    expect(formatTime(0.9)).toBe("0:00");
    expect(formatTime(59.9)).toBe("0:59");
  });

  it("reads invalid or negative input as 0:00", () => {
    expect(formatTime(-1)).toBe("0:00");
    expect(formatTime(Number.NaN)).toBe("0:00");
  });
});
