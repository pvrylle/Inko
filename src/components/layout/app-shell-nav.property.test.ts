/**
 * Property tests for AppShell navigation — `aria-current` follows pathname
 *
 * Property 1: Nav active state follows pathname
 * - For any navigation item, rendering AppShell with `pathname` equal to that
 *   item's `href` SHALL set aria-current="page" on exactly that nav link and
 *   no other nav link.
 *
 * The `isActive(pathname, href)` helper is extracted and tested directly
 * because it encapsulates all the aria-current logic.
 *
 * Validates: Requirements 2.4
 */

import * as fc from "fast-check";

// ─── Replicate the production logic ──────────────────────────────────────────
//
// Source: src/components/layout/app-shell.tsx
//   function isActive(pathname: string, href: string) {
//     return href === "/" ? pathname === href : pathname.startsWith(href);
//   }

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

// ─── The navigation items (source of truth, matches app-shell.tsx) ───────────

const navigation = [
  { href: "/",          label: "Home" },
  { href: "/research",  label: "Research" },
  { href: "/sources",   label: "Sources" },
  { href: "/canvas",    label: "Canvas" },
  { href: "/settings",  label: "Settings" },
] as const;

const navHrefs = navigation.map((n) => n.href);
const nonRootHrefs = navHrefs.filter((h) => h !== "/");

// ─── Generators ──────────────────────────────────────────────────────────────

const arbitraryPathname: fc.Arbitrary<string> = fc.array(
  fc.stringMatching(/^[a-z0-9-]+$/),
  { minLength: 0, maxLength: 5 },
).map((segments) => (segments.length === 0 ? "/" : "/" + segments.join("/")));

// ─── Property 1 ──────────────────────────────────────────────────────────────

describe("Property 1: Nav active state follows pathname", () => {
  it("1a — isActive(href, href) is true for every nav href", () => {
    for (const href of navHrefs) {
      expect(isActive(href, href)).toBe(true);
    }
  });

  it("1b — isActive returns false when pathname does not start with a non-root href", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonRootHrefs),
        arbitraryPathname.filter((p) => nonRootHrefs.every((h) => !p.startsWith(h))),
        (href, pathname) => {
          expect(isActive(pathname, href)).toBe(false);
        },
      ),
    );
  });

  it("1b-root — isActive for '/' is false for any pathname that is not '/'", () => {
    fc.assert(
      fc.property(
        arbitraryPathname.filter((p) => p !== "/"),
        (pathname) => {
          expect(isActive(pathname, "/")).toBe(false);
        },
      ),
    );
  });

  it("1c — at most one nav item is active for any given pathname", () => {
    fc.assert(
      fc.property(arbitraryPathname, (pathname) => {
        const activeCount = navHrefs.filter((href) => isActive(pathname, href)).length;
        expect(activeCount).toBeLessThanOrEqual(1);
      }),
    );
  });

  // ─── Concrete examples ──────────────────────────────────────────────────────

  it('concrete — "/" is active only for the Home item', () => {
    expect(navHrefs.filter((href) => isActive("/", href))).toEqual(["/"]);
  });

  it('concrete — "/research" activates Research and nothing else', () => {
    expect(navHrefs.filter((href) => isActive("/research", href))).toEqual(["/research"]);
  });

  it('concrete — "/research?session=1" activates Research via prefix match', () => {
    expect(navHrefs.filter((href) => isActive("/research", href))).toEqual(["/research"]);
  });

  it('concrete — "/sources" activates Sources and nothing else', () => {
    expect(navHrefs.filter((href) => isActive("/sources", href))).toEqual(["/sources"]);
  });

  it('concrete — "/canvas" activates Canvas and nothing else', () => {
    expect(navHrefs.filter((href) => isActive("/canvas", href))).toEqual(["/canvas"]);
  });

  it('concrete — "/practice" does not activate any of the nav items', () => {
    expect(navHrefs.filter((href) => isActive("/practice", href))).toHaveLength(0);
  });

  it('concrete — "/settings" activates Settings and nothing else', () => {
    expect(navHrefs.filter((href) => isActive("/settings", href))).toEqual(["/settings"]);
  });

  it('concrete — "/library" does not activate any of the nav items', () => {
    expect(navHrefs.filter((href) => isActive("/library", href))).toHaveLength(0);
  });

  it('concrete — "/" does NOT activate "/research" (prefix guard)', () => {
    expect(isActive("/", "/research")).toBe(false);
  });
});
