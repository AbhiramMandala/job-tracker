import { describe, expect, it } from "vitest";
import { emailError, isValidEmail, normalizeEmail } from "./email";

describe("email validation (mirrors backend semantics)", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeEmail("  User@Example.com  ")).toBe("user@example.com");
  });

  it("requires a non-empty email", () => {
    expect(emailError("")).toBe("Email is required.");
    expect(emailError("   ")).toBe("Email is required.");
  });

  it("rejects malformed addresses with the exact message", () => {
    for (const bad of ["abc", "abc@", "abc@domain", "@domain.com", "abc domain@gmail.com", "abc@@gmail.com"]) {
      expect(isValidEmail(bad)).toBe(false);
      expect(emailError(bad)).toBe("Please enter a valid email address.");
    }
  });

  it("accepts well-formed addresses", () => {
    for (const good of ["a@b.com", "User@Example.com", "first.last+tag@sub.domain.co"]) {
      expect(isValidEmail(good)).toBe(true);
      expect(emailError(good)).toBeNull();
    }
  });
});
