//! Port of `apps/api/src/shared/search/mappers/strip-mdx.ts`.
//!
//! The regexes are translated to keep JavaScript semantics exactly: JS `.`
//! excludes all line terminators (`\n \r \u2028 \u2029`), JS `\s` is a fixed
//! set (not Unicode White_Space), `\d` is ASCII, and `^`/`$` in multiline mode
//! match around any line terminator. `fancy-regex` provides the lookarounds and
//! backreferences this needs.

use std::sync::LazyLock;

use fancy_regex::Regex;

const DOT: &str = r"[^\n\r\x{2028}\x{2029}]";
const WS: &str = r"[\t\n\x0B\x0C\r \x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]";
const BOL: &str = r"(?:\A|(?<=[\n\r\x{2028}\x{2029}]))";
const EOL: &str = r"(?=[\n\r\x{2028}\x{2029}]|\z)";

struct Rule {
    re: Regex,
    replacement: &'static str,
}

fn rule(pattern: String, replacement: &'static str) -> Rule {
    Rule {
        re: Regex::new(&pattern)
            .unwrap_or_else(|e| panic!("invalid strip-mdx regex {pattern}: {e}")),
        replacement,
    }
}

static RULES: LazyLock<Vec<Rule>> = LazyLock::new(|| {
    vec![
        // /```[\s\S]*?```/g
        rule(r"```(?s:.)*?```".to_string(), " "),
        // /`[^`]*`/g
        rule(r"`[^`]*`".to_string(), " "),
        // /^import\s+.*$/gm
        rule(format!(r"{BOL}import{WS}+{DOT}*{EOL}"), " "),
        // /^export\s+.*$/gm
        rule(format!(r"{BOL}export{WS}+{DOT}*{EOL}"), " "),
        // /<[^>]+>/g
        rule(r"<[^>]+>".to_string(), " "),
        // /!\[[^\]]*\]\([^)]*\)/g
        rule(r"!\[[^\]]*\]\([^)]*\)".to_string(), " "),
        // /\[([^\]]*)\]\([^)]*\)/g -> " $1 "
        rule(r"\[([^\]]*)\]\([^)]*\)".to_string(), " ${1} "),
        // /^#{1,6}\s+/gm
        rule(format!(r"{BOL}#{{1,6}}{WS}+"), ""),
        // /(\*\*|__)(.*?)\1/g -> "$2"
        rule(format!(r"(\*\*|__)({DOT}*?)\1"), "${2}"),
        // /(\*|_)(.*?)\1/g -> "$2"
        rule(format!(r"(\*|_)({DOT}*?)\1"), "${2}"),
        // /^\s*>\s+/gm
        rule(format!(r"{BOL}{WS}*>{WS}+"), ""),
        // /^\s*[-*+]\s+/gm
        rule(format!(r"{BOL}{WS}*[-*+]{WS}+"), ""),
        // /^\s*\d+\.\s+/gm
        rule(format!(r"{BOL}{WS}*[0-9]+\.{WS}+"), ""),
        // /\n{2,}/g
        rule(r"\n{2,}".to_string(), " "),
        // /\s+/g
        rule(format!(r"{WS}+"), " "),
    ]
});

fn replace_all(re: &Regex, input: &str, replacement: &str) -> String {
    // The patterns cannot hit the backtracking limit on realistic input; if one
    // ever does, keep the text unchanged for that rule rather than fail.
    re.try_replacen(input, 0, replacement)
        .map(|s| s.into_owned())
        .unwrap_or_else(|_| input.to_string())
}

/// Strips MDX/Markdown syntax to plain text for full-text search.
pub fn strip_mdx(content: &str) -> String {
    let mut s = content.to_string();
    for rule in RULES.iter() {
        s = replace_all(&rule.re, &s, rule.replacement);
    }
    // After the final rule every JS-whitespace run is a single space, so
    // trimming spaces equals JS `String.prototype.trim()`.
    s.trim_matches(' ').to_string()
}

#[cfg(test)]
mod tests {
    use super::strip_mdx;

    // Same cases as apps/api/src/shared/search/mappers/strip-mdx.spec.ts.
    #[test]
    fn matches_the_typescript_spec() {
        assert_eq!(strip_mdx("# Hello world"), "Hello world");
        assert_eq!(strip_mdx("### Nested heading"), "Nested heading");
        assert_eq!(
            strip_mdx("This is **bold** and *italic* text"),
            "This is bold and italic text"
        );
        assert_eq!(strip_mdx("__strong__ and _em_"), "strong and em");
        assert_eq!(
            strip_mdx("See [the docs](https://example.com) now"),
            "See the docs now"
        );
        assert_eq!(strip_mdx("![alt text](cover.png) caption"), "caption");
        assert_eq!(
            strip_mdx("before\n```\nconst x = 1;\n```\nafter"),
            "before after"
        );
        assert_eq!(strip_mdx("run `npm install` first"), "run first");
        assert_eq!(
            strip_mdx("import Foo from './foo'\nActual content"),
            "Actual content"
        );
        assert_eq!(strip_mdx("export const meta = {}\nBody text"), "Body text");
        assert_eq!(
            strip_mdx("<Callout>Heads up</Callout> rest"),
            "Heads up rest"
        );
        assert_eq!(strip_mdx("> quoted line"), "quoted line");
        assert_eq!(strip_mdx("- item one\n- item two"), "item one item two");
        assert_eq!(strip_mdx("1. first\n2. second"), "first second");
        assert_eq!(strip_mdx("  spaced   out \n\n text  "), "spaced out text");
        assert_eq!(strip_mdx(""), "");
        assert_eq!(
            strip_mdx("# Şarj İstasyonu\nElektrikli araç içeriği"),
            "Şarj İstasyonu Elektrikli araç içeriği"
        );
        let input = [
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
        ]
        .join("\n");
        assert_eq!(
            strip_mdx(&input),
            "Building the thing This is important and references the guide . point one point two"
        );
    }

    // Outputs below were produced by running the TypeScript stripMdx.
    #[test]
    fn javascript_line_terminator_and_whitespace_semantics() {
        assert_eq!(strip_mdx("import x\r\nBody"), "Body");
        assert_eq!(strip_mdx("# Title\r\n\r\n- a\r\n- b"), "Title a b");
        assert_eq!(strip_mdx("**bold\rline** end"), "bold line end");
        assert_eq!(strip_mdx("a\u{2028}# b"), "a b");
        assert_eq!(strip_mdx("\u{FEFF}x\u{0085}y\u{FEFF}"), "x\u{0085}y");
        assert_eq!(strip_mdx("12. ١٢ arabic digits"), "١٢ arabic digits");
        assert_eq!(
            strip_mdx("snake_case_name and_more"),
            "snakecasename and_more"
        );
    }
}
