import { variantClasses } from "../text";

// On the web, the variant's `text-sm` beat a caller's `text-[13px]` whatever the
// class order: the size the design asks for was silently ignored.
describe("Text variant classes", () => {
  it("keeps the variant size when the caller sets none", () => {
    expect(variantClasses("body", "mt-1 text-text-sub")).toBe("text-sm text-text");
    expect(variantClasses("caption", "")).toBe("text-xs text-text-sub");
  });

  it("drops the variant size when the caller sets an arbitrary one", () => {
    expect(variantClasses("caption", "text-[13px]")).toBe("text-text-sub");
    expect(variantClasses("body", "mt-0.5 text-[15.5px] capitalize")).toBe("text-text");
  });

  it("drops it for a scale size too, but not for a colour that starts with text-", () => {
    expect(variantClasses("body", "text-lg tracking-[-0.3px]")).toBe("text-text");
    expect(variantClasses("body", "text-text-muted text-accent")).toBe("text-sm text-text");
  });
});
