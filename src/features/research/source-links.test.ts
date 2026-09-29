import { openableUrl, sourceQuickLinks } from "./source-links";

describe("sourceQuickLinks", () => {
  it("keeps an https source URL and adds Wikipedia and Scholar lookups", () => {
    const links = sourceQuickLinks({ title: "The Behavioral Immune System", url: "https://example.com/paper" });
    expect(links[0]).toEqual({ label: "Open", href: "https://example.com/paper" });
    expect(links.map((link) => link.label)).toEqual(["Open", "Wikipedia", "Scholar"]);
    expect(links[1]?.href).toContain("wikipedia.org");
    expect(links[1]?.href).toContain(encodeURIComponent("The Behavioral Immune System"));
  });

  it("drops javascript URLs and still offers lookup links", () => {
    expect(openableUrl("javascript:alert(1)")).toBeNull();
    const links = sourceQuickLinks({ title: "Core background", url: "javascript:alert(1)" });
    expect(links.every((link) => link.href.startsWith("https://"))).toBe(true);
    expect(links.some((link) => link.label === "Open")).toBe(false);
  });
});
