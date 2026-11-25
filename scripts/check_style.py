"""Check the look follows the theme rules (Phase 3, Flower Field theme).

Searches css/*.css, js/*.js and index.html (comments are ignored) and flags:
  - any gradient (linear-, radial-, conic-, repeating-…)
  - blur( and filter: (no blurs, glows or CSS filters)
  - blurred shadows: a shadow value whose third length (the blur) isn't 0
  - see-through colours: rgba()/hsla() with an alpha below 1 (no transparency washes)
  - any colour literal (#hex, rgb(), hsl()) outside the Theme tokens block,
    which is everything between "THEME TOKENS: START" and "THEME TOKENS: END"
    in css/styles.css

Exits with status 1 if anything is found, 0 if the style is clean.

Run from anywhere:  python3 scripts/check_style.py
"""

import re
import sys
from pathlib import Path

# ----------------------------------------------------------
# Setup
# ----------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
STYLESHEET = PROJECT_ROOT / "css" / "styles.css"
TOKENS_START = "THEME TOKENS: START"
TOKENS_END = "THEME TOKENS: END"

HEX_COLOUR = re.compile(r"#[0-9a-fA-F]{3,8}\b")
COLOUR_FUNCTION = re.compile(r"\b(?:rgba?|hsla?)\([^)]*\)", re.IGNORECASE)
SEE_THROUGH = re.compile(r"\b(?:rgba|hsla)\(([^)]*)\)", re.IGNORECASE)
SHADOW_DECLARATION = re.compile(r"((?:--[\w-]*shadow[\w-]*)|box-shadow|text-shadow)\s*:\s*([^;]+);")
LENGTH = re.compile(r"-?\d*\.?\d+(?:px|rem|em)?\b")
BANNED_WORDS = [
    (re.compile(r"gradient", re.IGNORECASE), "gradient"),
    (re.compile(r"blur\(", re.IGNORECASE), "blur()"),
    (re.compile(r"filter\s*:", re.IGNORECASE), "CSS filter"),
]


# ----------------------------------------------------------
# Reading files
# ----------------------------------------------------------

def strip_comments(text, suffix):
    """Blank out comments but keep every newline, so line numbers stay right."""
    patterns = [r"/\*.*?\*/"]
    if suffix == ".js":
        # Line comments, but not the "//" inside a URL such as https://
        patterns.append(r"(?<![:\"'])//[^\n]*")
    if suffix == ".html":
        patterns.append(r"<!--.*?-->")
    for pattern in patterns:
        text = re.sub(pattern, lambda match: re.sub(r"[^\n]", " ", match.group(0)), text, flags=re.DOTALL)
    return text


def files_to_check():
    """Every file the app's look comes from."""
    return sorted((PROJECT_ROOT / "css").glob("*.css")) + sorted((PROJECT_ROOT / "js").glob("*.js")) \
        + [PROJECT_ROOT / "index.html"]


def tokens_line_range(raw_text):
    """The first and last line numbers of the Theme tokens block in styles.css."""
    lines = raw_text.splitlines()
    start = next((number for number, line in enumerate(lines, 1) if TOKENS_START in line), None)
    end = next((number for number, line in enumerate(lines, 1) if TOKENS_END in line), None)
    if start is None or end is None:
        sys.exit(f"Couldn't find the '{TOKENS_START}' and '{TOKENS_END}' markers in css/styles.css.")
    return start, end


# ----------------------------------------------------------
# Checks (each returns a list of problem messages for one line)
# ----------------------------------------------------------

def check_banned_words(line):
    """Gradients, blur() and CSS filters are never allowed."""
    return [f"uses a {name}" for pattern, name in BANNED_WORDS if pattern.search(line)]


def check_see_through(line):
    """rgba()/hsla() with an alpha below 1 is a transparency wash."""
    problems = []
    for match in SEE_THROUGH.finditer(line):
        arguments = match.group(1)
        # Two ways to write alpha: "r, g, b, 0.5" or "r g b / 50%".
        if "/" in arguments:
            alpha = arguments.split("/")[1].strip()
        else:
            parts = [part.strip() for part in arguments.split(",")]
            alpha = parts[3] if len(parts) == 4 else "1"
        value = float(alpha[:-1]) / 100 if alpha.endswith("%") else float(alpha)
        if value < 1:
            problems.append(f"see-through colour {match.group(0)}")
    return problems


def check_blurred_shadows(line):
    """A shadow's third length is its blur radius; it must be 0 (hard shadows only)."""
    problems = []
    for name, value in SHADOW_DECLARATION.findall(line):
        for shadow in value.split(","):
            lengths = LENGTH.findall(shadow)
            if len(lengths) >= 3 and float(re.sub(r"[a-z]+$", "", lengths[2])) != 0:
                problems.append(f"blurred shadow in {name}: {shadow.strip()}")
    return problems


def check_colour_literals(line):
    """Colour values may only be written inside the Theme tokens block."""
    found = HEX_COLOUR.findall(line) + COLOUR_FUNCTION.findall(line)
    return [f"colour {colour} outside the Theme tokens block" for colour in found]


# ----------------------------------------------------------
# Running the checks
# ----------------------------------------------------------

def check_file(path):
    """Run every check on one file and return its findings."""
    raw_text = path.read_text(encoding="utf-8")
    text = strip_comments(raw_text, path.suffix)
    tokens_range = tokens_line_range(raw_text) if path == STYLESHEET else None
    findings = []
    for number, line in enumerate(text.splitlines(), 1):
        inside_tokens = tokens_range is not None and tokens_range[0] <= number <= tokens_range[1]
        problems = check_banned_words(line) + check_see_through(line) + check_blurred_shadows(line)
        if not inside_tokens:
            problems += check_colour_literals(line)
        relative = path.relative_to(PROJECT_ROOT).as_posix()
        findings += [f"{relative}:{number}: {problem}" for problem in problems]
    return findings


def main():
    """Check every file, print what was found and set the exit code."""
    findings = [finding for path in files_to_check() for finding in check_file(path)]
    if findings:
        print(f"{len(findings)} style problem(s) found:")
        for finding in findings:
            print(f"  - {finding}")
        sys.exit(1)
    print("OK: no gradients, blurs, filters, see-through colours or stray colour values.")


if __name__ == "__main__":
    main()
