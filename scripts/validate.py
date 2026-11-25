"""Validate the question bank and its sources.

Checks data/sources.json and data/questions.json and prints:
  - question counts per section and level (adult questions counted separately)
  - missing or invalid fields
  - source_ids that are not in sources.json
  - exact duplicates (after lowercasing and removing punctuation)
  - near-duplicates (word-overlap similarity above 0.8)
  - questions that open like a yes/no question ("Do you...", "Have you...")
  - dares that end with a question mark (probably a question filed as a dare)
  - party cards outside Friends, and 18+ cards outside Dating levels 2 and 3
  - party cards that mention drinking other than "take a sip" (Party mode safety)

Exits with status 1 if any problem is found, 0 otherwise.

Run from anywhere:  python3 scripts/validate.py
Check a different questions file:  python3 scripts/validate.py data/sample.json
"""

import json
import re
import string
import sys
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

# ----------------------------------------------------------
# Setup: file paths and rules
# ----------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_PATH = PROJECT_ROOT / "data" / "questions.json"
SOURCES_PATH = PROJECT_ROOT / "data" / "sources.json"

# Sections and the id prefix each one uses ("ice-1-0001", "fri-2-0042").
SECTION_ID_PREFIX = {"icebreaker": "ice", "dating": "date", "friends": "fri"}
SECTIONS = tuple(SECTION_ID_PREFIX)
LEVELS = (1, 2, 3)
CARD_TYPES = ("question", "dare")
# Which sections may hold 18+ cards (and at which levels), and party cards.
ADULT_SECTIONS = ("dating",)
ADULT_ALLOWED_LEVELS = (2, 3)
PARTY_SECTIONS = ("friends",)

QUESTION_FIELDS = ("id", "section", "level", "category", "adult", "type", "party",
                   "text", "why", "framework", "source_id")
SOURCE_FIELDS = ("id", "title", "url", "framework")

MAX_WHY_WORDS = 19                     # "one sentence under 20 words"
NEAR_DUPLICATE_THRESHOLD = 0.8         # word-overlap (Jaccard) similarity
QUESTION_ID_PATTERN = re.compile(r"^(" + "|".join(SECTION_ID_PREFIX.values()) + r")-([123])-(\d{4})$")
# Questions must be open-ended, so these opening words are flagged.
# "Would you rather" is allowed because it asks for a choice and a reason.
YES_NO_OPENERS = {"am", "are", "is", "was", "were", "do", "does", "did", "have", "has",
                  "had", "can", "could", "will", "would", "should", "shall", "may", "might"}
ALLOWED_OPENER_PHRASES = ("would you rather",)
# Party mode safety: cards say "take a sip", never these. Matched as whole words,
# so "soft drink" in the rules screen is fine but a card saying "drink" is flagged.
PARTY_BANNED_WORDS = ("drink", "drinks", "drinking", "chug", "chugging", "shot", "shots",
                      "down it", "finish your", "bottoms up")


# ----------------------------------------------------------
# Data loading
# ----------------------------------------------------------

def load_json_list(path):
    """Load a JSON file that must contain a list; exit with a clear message if not."""
    relative_name = path.name
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        sys.exit(f"Couldn't find {relative_name}.")
    except json.JSONDecodeError as error:
        sys.exit(f"{relative_name} is not valid JSON: {error}")
    if not isinstance(data, list):
        sys.exit(f"{relative_name} must contain a JSON array.")
    return data


# ----------------------------------------------------------
# Shared helpers
# ----------------------------------------------------------

def is_filled_string(value):
    """True if the value is a string with visible text in it."""
    return isinstance(value, str) and value.strip() != ""


def normalise_text(text):
    """Lowercase and strip punctuation so trivial differences don't hide duplicates."""
    without_punctuation = text.lower().translate(str.maketrans("", "", string.punctuation + "’‘“”"))
    return " ".join(without_punctuation.split())


def word_overlap(words_a, words_b):
    """Jaccard similarity: shared words divided by all distinct words."""
    if not words_a or not words_b:
        return 0.0
    return len(words_a & words_b) / len(words_a | words_b)


def opens_like_yes_no(text):
    """True if the question starts like 'Do you...' rather than 'What...' or 'How...'."""
    lowered = text.strip().lower()
    if lowered.startswith(ALLOWED_OPENER_PHRASES):
        return False
    first_word = lowered.split()[0].strip(string.punctuation)
    return first_word in YES_NO_OPENERS


def find_duplicate_values(values):
    """Return the text values that appear more than once (non-text values are skipped,
    because a malformed id such as a list can't be counted and is reported elsewhere)."""
    text_values = [value for value in values if isinstance(value, str)]
    return [value for value, count in Counter(text_values).items() if count > 1]


# ----------------------------------------------------------
# Source checks
# ----------------------------------------------------------

def check_sources(sources):
    """Check every source has all fields and that ids and URLs are unique."""
    problems = []
    for index, source in enumerate(sources):
        label = f"source #{index + 1}"
        if isinstance(source, dict) and is_filled_string(source.get("id")):
            label = source["id"]
        if not isinstance(source, dict):
            problems.append(f"{label}: must be an object")
            continue
        for field in SOURCE_FIELDS:
            if not is_filled_string(source.get(field)):
                problems.append(f"{label}: missing or empty '{field}'")
        if is_filled_string(source.get("url")) and not source["url"].startswith("https://"):
            problems.append(f"{label}: url should start with https://")
    for duplicate_id in find_duplicate_values(s.get("id") for s in sources if isinstance(s, dict)):
        problems.append(f"Duplicate source id: {duplicate_id}")
    for duplicate_url in find_duplicate_values(s.get("url") for s in sources if isinstance(s, dict)):
        problems.append(f"Duplicate source url: {duplicate_url}")
    return problems


# ----------------------------------------------------------
# Question field checks
# ----------------------------------------------------------

def check_question_basics(question, label):
    """Check that every schema field is present and of the right type."""
    problems = []
    for field in QUESTION_FIELDS:
        if field not in question:
            problems.append(f"{label}: missing '{field}'")
    for field in ("id", "category", "text", "why", "framework", "source_id"):
        if field in question and not is_filled_string(question[field]):
            problems.append(f"{label}: '{field}' must be non-empty text")
    if question.get("section") not in SECTIONS:
        problems.append(f"{label}: section must be one of {SECTIONS}")
    if question.get("level") not in LEVELS or isinstance(question.get("level"), bool):
        problems.append(f"{label}: level must be 1, 2 or 3")
    if not isinstance(question.get("adult"), bool):
        problems.append(f"{label}: adult must be true or false")
    if question.get("type") not in CARD_TYPES:
        problems.append(f"{label}: type must be 'question' or 'dare'")
    if not isinstance(question.get("party"), bool):
        problems.append(f"{label}: party must be true or false")
    return problems


def check_question_id(question, label):
    """Check the id looks like 'ice-1-0001' and agrees with section and level."""
    match = QUESTION_ID_PATTERN.match(str(question.get("id", "")))
    if not match:
        return [f"{label}: id must look like ice-1-0001, date-2-0042 or fri-3-0007"]
    prefix, level_text, _ = match.groups()
    problems = []
    if SECTION_ID_PREFIX.get(question.get("section")) != prefix:
        problems.append(f"{label}: id prefix '{prefix}' doesn't match section '{question.get('section')}'")
    if question.get("level") != int(level_text):
        problems.append(f"{label}: id level {level_text} doesn't match level {question.get('level')}")
    return problems


def check_placement_rules(question, label):
    """Check 18+ cards sit only in Dating levels 2-3, and party cards only in Friends."""
    problems = []
    if question.get("adult") is True:
        if question.get("section") not in ADULT_SECTIONS:
            problems.append(f"{label}: adult cards are only allowed in dating")
        elif question.get("level") not in ADULT_ALLOWED_LEVELS:
            problems.append(f"{label}: adult cards are only allowed in dating levels 2 and 3")
    if question.get("party") is True and question.get("section") not in PARTY_SECTIONS:
        problems.append(f"{label}: party cards are only allowed in friends")
    return problems


def check_text_rules(question, label):
    """Check the wording: why length, open-ended questions, and dares that aren't questions."""
    problems = []
    why = question.get("why")
    if is_filled_string(why) and len(why.split()) > MAX_WHY_WORDS:
        problems.append(f"{label}: why has {len(why.split())} words (must be under 20)")
    text = question.get("text")
    if not is_filled_string(text):
        return problems
    # Dares are instructions ("Do an impression..."), so only questions get the yes/no check.
    if question.get("type") == "question" and opens_like_yes_no(text):
        problems.append(f"{label}: opens like a yes/no question; rephrase to be open-ended")
    if question.get("type") == "dare" and text.rstrip().endswith("?"):
        problems.append(f"{label}: dare ends with '?'; is it really a question?")
    if question.get("party") is True:
        problems += check_party_wording(text, label)
    return problems


def check_party_wording(text, label):
    """Party mode safety: flag drinking words other than 'take a sip'."""
    lowered = text.lower()
    found = [word for word in PARTY_BANNED_WORDS
             if re.search(r"\b" + re.escape(word) + r"\b", lowered)]
    if found:
        return [f"{label}: party card uses {', '.join(found)}; say 'take a sip' instead"]
    return []


def check_question_rules(question, label, sources_by_id):
    """Check the content rules: placement, wording, and that the source and framework agree."""
    problems = check_placement_rules(question, label) + check_text_rules(question, label)
    source = sources_by_id.get(question.get("source_id"))
    if source is None:
        problems.append(f"{label}: source_id '{question.get('source_id')}' is not in sources.json")
    elif question.get("framework") != source.get("framework"):
        expected_framework = source.get("framework")
        problems.append(f"{label}: framework '{question.get('framework')}' doesn't match its source ('{expected_framework}')")
    return problems


def check_questions(questions, sources_by_id):
    """Run every per-question check and the unique-id check."""
    problems = []
    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            problems.append(f"question #{index + 1}: must be an object")
            continue
        question_id = question.get("id")
        label = question_id if is_filled_string(question_id) else f"question #{index + 1}"
        problems += check_question_basics(question, label)
        problems += check_question_id(question, label)
        problems += check_question_rules(question, label, sources_by_id)
    for duplicate_id in find_duplicate_values(q.get("id") for q in questions if isinstance(q, dict)):
        problems.append(f"Duplicate question id: {duplicate_id}")
    return problems


# ----------------------------------------------------------
# Duplicate text checks
# ----------------------------------------------------------

def check_duplicate_texts(questions):
    """Flag exact duplicates and near-duplicates by question text."""
    entries = []
    for index, question in enumerate(questions):
        if isinstance(question, dict) and is_filled_string(question.get("text")):
            question_id = question.get("id")
            label = question_id if is_filled_string(question_id) else f"question #{index + 1}"
            entries.append((label, normalise_text(question["text"])))
    problems = []
    ids_by_text = defaultdict(list)
    for question_id, text in entries:
        ids_by_text[text].append(question_id)
    for ids in ids_by_text.values():
        if len(ids) > 1:
            problems.append(f"Exact duplicate text: {', '.join(ids)}")
    word_sets = [(question_id, text, set(text.split())) for question_id, text in entries]
    for (id_a, text_a, words_a), (id_b, text_b, words_b) in combinations(word_sets, 2):
        if text_a != text_b and word_overlap(words_a, words_b) > NEAR_DUPLICATE_THRESHOLD:
            problems.append(f"Near-duplicate: {id_a} and {id_b}")
    return problems


# ----------------------------------------------------------
# Report
# ----------------------------------------------------------

def print_counts(questions):
    """Print a table of cards per section and level, split into the kinds that matter:
    18+ cards (Dating), party cards (Friends), and dares."""
    totals, adult, party, dares = Counter(), Counter(), Counter(), Counter()
    for question in questions:
        if isinstance(question, dict):
            key = (question.get("section"), question.get("level"))
            totals[key] += 1
            adult[key] += question.get("adult") is True
            party[key] += question.get("party") is True
            dares[key] += question.get("type") == "dare"
    print("Card counts (total / 18+ / party / dares):")
    for section in SECTIONS:
        cells = [f"L{level}: {totals[(section, level)]:>4} / {adult[(section, level)]:>3} / "
                 f"{party[(section, level)]:>3} / {dares[(section, level)]:>3}" for level in LEVELS]
        print(f"  {section:<11} " + "   ".join(cells))
    print(f"  Total: {len(questions)}")


def main():
    """Load both files, run every check, print a report and set the exit code."""
    questions_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else QUESTIONS_PATH
    sources = load_json_list(SOURCES_PATH)
    questions = load_json_list(questions_path)
    print(f"Checking {questions_path.name}")
    sources_by_id = {s["id"]: s for s in sources if isinstance(s, dict) and is_filled_string(s.get("id"))}

    print(f"Sources: {len(sources)}")
    print_counts(questions)

    problems = check_sources(sources)
    problems += check_questions(questions, sources_by_id)
    problems += check_duplicate_texts(questions)

    if problems:
        print(f"\n{len(problems)} problem(s) found:")
        for problem in problems:
            print(f"  - {problem}")
        sys.exit(1)
    print("\nOK: no problems found.")


if __name__ == "__main__":
    main()
