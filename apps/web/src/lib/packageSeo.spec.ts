import { describe, expect, it } from "vitest";
import {
  extractMarkdownSummary,
  resolvePackageDescription,
  resolvePackageDocsHref,
  stripLeadingDuplicateHeading,
} from "./packageSeo";

describe("resolvePackageDocsHref", () => {
  it("returns the matching named default doc when present in docsList", () => {
    expect(
      resolvePackageDocsHref({
        slug: "vefacustomauth",
        docs: "getting-started",
        docsList: [
          { slug: "overview", displayOrder: 0 },
          { slug: "getting-started", displayOrder: 1 },
        ],
      })
    ).toEqual({
      href: "/packages/vefacustomauth/docs/getting-started",
      external: false,
    });
  });

  it("falls back to the first ordered doc when docs is unset or not found", () => {
    expect(
      resolvePackageDocsHref({
        slug: "vefacustomauth",
        docs: "missing-doc",
        docsList: [
          { slug: "second", displayOrder: 2 },
          { slug: "first", displayOrder: 1 },
        ],
      })
    ).toEqual({
      href: "/packages/vefacustomauth/docs/first",
      external: false,
    });
  });

  it("returns an external docs URL when no internal docs exist", () => {
    expect(
      resolvePackageDocsHref({
        slug: "custompubsub",
        docs: "https://docs.example.com/custompubsub",
        docsList: [],
      })
    ).toEqual({
      href: "https://docs.example.com/custompubsub",
      external: true,
    });
  });

  it("returns null when a package group has no docs at all", () => {
    expect(
      resolvePackageDocsHref({
        slug: "custompubsub",
        docs: null,
        docsList: [],
      })
    ).toBeNull();
  });
});

describe("extractMarkdownSummary", () => {
  it("skips headings and extracts the first prose paragraph", () => {
    const md = [
      "# Vefa.CustomAuth.AspNetCore",
      "",
      "ASP.NET Core endpoint and dependency injection integration for `Vefa.CustomAuth`.",
      "This package maps [OAuth2](https://oauth.net) endpoints.",
      "",
      "## Typical Usage",
      "```csharp",
      "app.MapCustomAuthEndpoints();",
      "```",
    ].join("\n");

    expect(extractMarkdownSummary(md)).toBe(
      "ASP.NET Core endpoint and dependency injection integration for Vefa.CustomAuth. This package maps OAuth2 endpoints."
    );
  });

  it("truncates long paragraphs cleanly at a word boundary", () => {
    const longText = "ASP.NET Core endpoint and dependency injection integration for Vefa.CustomAuth that registers runtime services and maps OpenID Connect endpoints cleanly across distributed hosts.";
    const summary = extractMarkdownSummary(longText, 120);
    expect(summary).not.toBeNull();
    expect(summary!.length).toBeLessThanOrEqual(120);
    expect(summary!.endsWith("…")).toBe(true);
  });

  it("returns null for content without prose paragraphs", () => {
    expect(extractMarkdownSummary("# Only Heading\n\n```ts\nconst x = 1;\n```")).toBeNull();
  });
});

describe("resolvePackageDescription", () => {
  it("prefers explicit description over markdown content", () => {
    expect(resolvePackageDescription("Explicit desc", "Markdown body", "Fallback")).toBe("Explicit desc");
  });

  it("uses markdown summary when explicit description is empty", () => {
    expect(resolvePackageDescription("", "# Pkg\n\nReal summary here.", "Fallback")).toBe("Real summary here.");
  });

  it("falls back when both description and content are empty", () => {
    expect(resolvePackageDescription(null, "", "Fallback")).toBe("Fallback");
  });
});

describe("stripLeadingDuplicateHeading", () => {
  it("removes a leading h1 that matches the page title", () => {
    const md = "# Vefa.CustomAuth.AspNetCore\n\nASP.NET Core integration.";
    expect(stripLeadingDuplicateHeading(md, "Vefa.CustomAuth.AspNetCore")).toBe("ASP.NET Core integration.");
  });

  it("keeps a leading h1 when it differs from the page title", () => {
    const md = "# Overview\n\nSome content.";
    expect(stripLeadingDuplicateHeading(md, "Vefa.CustomAuth.AspNetCore")).toBe(md);
  });
});
