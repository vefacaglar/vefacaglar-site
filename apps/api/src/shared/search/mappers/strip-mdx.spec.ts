import { describe, it, expect } from "vitest";
import { stripMdx } from "./strip-mdx";

describe("stripMdx", () => {
  it("removes heading markers but keeps the text", () => {
    expect(stripMdx("# Hello world")).toBe("Hello world");
    expect(stripMdx("### Nested heading")).toBe("Nested heading");
  });

  it("unwraps bold and italic emphasis", () => {
    expect(stripMdx("This is **bold** and *italic* text")).toBe(
      "This is bold and italic text"
    );
    expect(stripMdx("__strong__ and _em_")).toBe("strong and em");
  });

  it("keeps link text and drops the URL", () => {
    expect(stripMdx("See [the docs](https://example.com) now")).toBe(
      "See the docs now"
    );
  });

  it("drops images entirely", () => {
    expect(stripMdx("![alt text](cover.png) caption")).toBe("caption");
  });

  it("strips fenced and inline code", () => {
    expect(stripMdx("before\n```\nconst x = 1;\n```\nafter")).toBe("before after");
    expect(stripMdx("run `npm install` first")).toBe("run first");
  });

  it("removes import/export statement lines", () => {
    expect(stripMdx("import Foo from './foo'\nActual content")).toBe("Actual content");
    expect(stripMdx("export const meta = {}\nBody text")).toBe("Body text");
  });

  it("strips JSX / HTML tags but keeps inner text", () => {
    expect(stripMdx("<Callout>Heads up</Callout> rest")).toBe("Heads up rest");
  });

  it("removes blockquote, unordered and ordered list markers", () => {
    expect(stripMdx("> quoted line")).toBe("quoted line");
    expect(stripMdx("- item one\n- item two")).toBe("item one item two");
    expect(stripMdx("1. first\n2. second")).toBe("first second");
  });

  it("collapses surrounding and repeated whitespace", () => {
    expect(stripMdx("  spaced   out \n\n text  ")).toBe("spaced out text");
    expect(stripMdx("")).toBe("");
  });

  it("preserves non-ASCII (Turkish) characters", () => {
    expect(stripMdx("# Şarj İstasyonu\nElektrikli araç içeriği")).toBe(
      "Şarj İstasyonu Elektrikli araç içeriği"
    );
  });

  it("handles a combined realistic MDX document", () => {
    const input = [
      "import { Note } from './note'",
      "",
      "# Building the thing",
      "",
      "This is **important** and references [the guide](https://x.com).",
      "",
      "```ts",
      "const secret = 42;",
      "```",
      "",
      "- point one",
      "- point two",
    ].join("\n");

    // Note: a link leaves a trailing space before following punctuation
    // ("the guide ."). Harmless for search tokenization.
    expect(stripMdx(input)).toBe(
      "Building the thing This is important and references the guide . point one point two"
    );
  });
});
