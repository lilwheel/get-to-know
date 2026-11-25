"""Check WCAG AA colour contrast for every theme.

Reads the colours straight from css/styles.css (the palette and the
--color-* roles for the neutral, icebreaker and dating themes) and checks
each pair of colours that appear together on screen:
  - text: at least 4.5 to 1 (WCAG AA for normal-size text)
  - controls and graphics (borders, dots, switch, focus ring):
    at least 3 to 1 (WCAG AA for non-text contrast)

Exits with status 1 if any pair fails.

Run from anywhere:  python3 scripts/check_contrast.py
"""

import re
import sys
from pathlib import Path

# ----------------------------------------------------------
# Setup
# ----------------------------------------------------------
STYLESHEET_PATH = Path(__file__).resolve().parent.parent / "css" / "styles.css"
THEMES = ("neutral", "icebreaker", "dating")
TEXT_MINIMUM = 4.5
GRAPHIC_MINIMUM = 3.0
BACKGROUNDS_BEHIND_PAGE_ITEMS = ("backdrop-start", "backdrop-end")

# Each entry: (description, foreground role, background roles, minimum ratio).
# Role names are the --color-* variables without the "--color-" prefix.
PAIRS = [
    ("Question and body text on a card", "text", ["card-background"], TEXT_MINIMUM),
    ("Headings and labels on the page", "text", BACKGROUNDS_BEHIND_PAGE_ITEMS, TEXT_MINIMUM),
    ("Footnote 'why' text on a card", "text-muted", ["card-background"], TEXT_MINIMUM),
    ("Muted labels on the page", "text-muted", BACKGROUNDS_BEHIND_PAGE_ITEMS, TEXT_MINIMUM),
    ("Source link on a card", "link", ["card-background"], TEXT_MINIMUM),
    ("Link-style button on the page", "link", BACKGROUNDS_BEHIND_PAGE_ITEMS, TEXT_MINIMUM),
    ("Button text", "button-text", ["button-background"], TEXT_MINIMUM),
    ("Primary button text", "button-primary-text", ["button-primary-background"], TEXT_MINIMUM),
    ("Button outline against the page", "button-border", BACKGROUNDS_BEHIND_PAGE_ITEMS, GRAPHIC_MINIMUM),
    ("Primary button against the page", "button-primary-background", BACKGROUNDS_BEHIND_PAGE_ITEMS, GRAPHIC_MINIMUM),
    ("Empty level dot", "level-dot-empty", BACKGROUNDS_BEHIND_PAGE_ITEMS, GRAPHIC_MINIMUM),
    ("Filled level dot", "level-dot-filled", BACKGROUNDS_BEHIND_PAGE_ITEMS, GRAPHIC_MINIMUM),
    ("Filled vs empty level dot", "level-dot-filled", ["level-dot-empty"], GRAPHIC_MINIMUM),
    ("Switch track when off", "switch-off", BACKGROUNDS_BEHIND_PAGE_ITEMS, GRAPHIC_MINIMUM),
    ("Switch track when on", "switch-on", BACKGROUNDS_BEHIND_PAGE_ITEMS, GRAPHIC_MINIMUM),
    ("Switch knob on its track", "switch-knob", ["switch-off", "switch-on"], GRAPHIC_MINIMUM),
    ("Keyboard focus ring", "focus-ring", ["card-background", *BACKGROUNDS_BEHIND_PAGE_ITEMS], GRAPHIC_MINIMUM),
]
NEUTRAL_ONLY_PAIRS = [
    ("Error message text", "error-text", ["error-background"], TEXT_MINIMUM),
]


# ----------------------------------------------------------
# Reading colours from the stylesheet
# ----------------------------------------------------------

def read_variable_block(css_text, selector):
    """Return {variable name: value} from the first rule with this exact selector."""
    match = re.search(re.escape(selector) + r"\s*\{(.*?)\}", css_text, re.DOTALL)
    if match is None:
        sys.exit(f"Couldn't find the rule '{selector}' in css/styles.css.")
    return dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", match.group(1)))


def build_theme_variables(css_text):
    """Return the full set of variables for each theme (neutral values plus overrides)."""
    root_variables = read_variable_block(css_text, ":root")
    themes = {"neutral": root_variables}
    for theme in THEMES[1:]:
        overrides = read_variable_block(css_text, f'[data-theme="{theme}"]')
        themes[theme] = {**root_variables, **overrides}
    return themes


def resolve_colour(variables, name):
    """Follow var(--x) references until a hex colour is reached."""
    value = variables.get(name, "").strip()
    for _ in range(10):
        reference = re.fullmatch(r"var\((--[\w-]+)\)", value)
        if reference is None:
            break
        value = variables.get(reference.group(1), "").strip()
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        sys.exit(f"{name} must resolve to a 6-digit hex colour, got '{value}'.")
    return value


# ----------------------------------------------------------
# Contrast maths (WCAG 2.x definitions)
# ----------------------------------------------------------

def relative_luminance(hex_colour):
    """How bright a colour looks to the eye, from 0 (black) to 1 (white)."""
    channels = [int(hex_colour[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast_ratio(colour_a, colour_b):
    """WCAG contrast ratio between two colours, from 1 to 21."""
    lighter, darker = sorted((relative_luminance(colour_a), relative_luminance(colour_b)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


# ----------------------------------------------------------
# Report
# ----------------------------------------------------------

def check_theme(theme, variables):
    """Print every pair for one theme and return how many failed."""
    pairs = PAIRS + (NEUTRAL_ONLY_PAIRS if theme == "neutral" else [])
    failures = 0
    print(f"\n{theme.upper()}")
    for description, foreground_role, background_roles, minimum in pairs:
        foreground = resolve_colour(variables, f"--color-{foreground_role}")
        for background_role in background_roles:
            background = resolve_colour(variables, f"--color-{background_role}")
            ratio = contrast_ratio(foreground, background)
            passed = ratio >= minimum
            failures += not passed
            status = "PASS" if passed else "FAIL"
            print(f"  {status}  {ratio:5.2f} (needs {minimum})  {description}: {foreground} on {background}")
    return failures


def main():
    """Check every theme and exit with an error if anything fails."""
    css_text = STYLESHEET_PATH.read_text(encoding="utf-8")
    themes = build_theme_variables(css_text)
    total_failures = sum(check_theme(theme, themes[theme]) for theme in THEMES)
    if total_failures:
        print(f"\n{total_failures} pair(s) below WCAG AA.")
        sys.exit(1)
    print("\nOK: every pair meets WCAG AA.")


if __name__ == "__main__":
    main()
