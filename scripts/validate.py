"""Validate the question bank and its sources.

Checks data/sources.json and data/questions.json and prints:
  - question counts per section and level (adult questions counted separately)
  - missing or invalid fields
  - source_ids that are not in sources.json
  - exact duplicates (after lowercasing and removing punctuation)
  - near-duplicates (word-overlap similarity above 0.8)

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

SECTIONS = ("icebreaker", "dating")
LEVELS = (1, 2, 3)
SECTION_ID_PREFIX = {"icebreaker": "ice", "dating": "date"}
ADULT_ALLOWED_LEVELS = (2, 3)

QUESTION_FIELDS = ("id", "section", "level", "category", "adult",
                   "text", "why", "framework", "source_id")
SOURCE_FIELDS = ("id", "title", "url", "framework")

MAX_WHY_WORDS = 19                     # "one sentence under 20 words"
NEAR_DUPLICATE_THRESHOLD = 0.8         # word-overlap (Jaccard) similarity
QUESTION_ID_PATTERN = re.compile(r"^(ice|date)-([123])-(\d{4})$")


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


def find_duplicate_values(values):
    """Return the values that appear more than once."""
    return [value for value, count in Counter(values).items() if count > 1]


# ----------------------------------------------------------
# Source checks
# ----------------------------------------------------------

def check_sources(sources):
    """Check every source has all fields and that ids and URLs are unique."""
    problems = []
    for index, source in enumerate(sources):
        label = source.get("id", f"source #{index + 1}") if isinstance(source, dict) else f"source #{index + 1}"
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
    return problems


def check_question_id(question, label):
    """Check the id looks like 'ice-1-0001' and agrees with section and level."""
    match = QUESTION_ID_PATTERN.match(str(question.get("id", "")))
    if not match:
        return [f"{label}: id must look like ice-1-0001 or date-2-0042"]
    prefix, level_text, _ = match.groups()
    problems = []
    if SECTION_ID_PREFIX.get(question.get("section")) != prefix:
        problems.append(f"{label}: id prefix '{prefix}' doesn't match section '{question.get('section')}'")
    if question.get("level") != int(level_text):
        problems.append(f"{label}: id level {level_text} doesn't match level {question.get('level')}")
    return problems


def check_question_rules(question, label, sources_by_id):
    """Check the content rules: adult placement, why length, source and framework."""
    problems = []
    if question.get("adult") is True:
        if question.get("section") != "dating":
            problems.append(f"{label}: adult questions are only allowed in dating")
        elif question.get("level") not in ADULT_ALLOWED_LEVELS:
            problems.append(f"{label}: adult questions are only allowed in dating levels 2 and 3")
    why = question.get("why")
    if is_filled_string(why) and len(why.split()) > MAX_WHY_WORDS:
        problems.append(f"{label}: why has {len(why.split())} words (must be under 20)")
    source = sources_by_id.get(question.get("source_id"))
    if source is None:
        problems.append(f"{label}: source_id '{question.get('source_id')}' is not in sources.json")
    elif question.get("framework") != source["framework"]:
        problems.append(f"{label}: framework '{question.get('framework')}' doesn't match its source ('{source['framework']}')")
    return problems


def check_questions(questions, sources_by_id):
    """Run every per-question check and the unique-id check."""
    problems = []
    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            problems.append(f"question #{index + 1}: must be an object")
            continue
        label = question.get("id") or f"question #{index + 1}"
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
    entries = [(q["id"], normalise_text(q["text"]))
               for q in questions if isinstance(q, dict) and is_filled_string(q.get("text"))]
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
    """Print how many questions each section and level holds, and how many are adult."""
    totals = Counter()
    adult_totals = Counter()
    for question in questions:
        if isinstance(question, dict):
            key = (question.get("section"), question.get("level"))
            totals[key] += 1
            adult_totals[key] += question.get("adult") is True
    print("Question counts (adult in brackets):")
    for section in SECTIONS:
        row = "  ".join(f"L{level}: {totals[(section, level)]} ({adult_totals[(section, level)]})"
                        for level in LEVELS)
        print(f"  {section:<11} {row}")
    print(f"  Total: {len(questions)}")


def main():
    """Load both files, run every check, print a report and set the exit code."""
    questions_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else QUESTIONS_PATH
    sources = load_json_list(SOURCES_PATH)
    questions = load_json_list(questions_path)
    print(f"Checking {questions_path.name}")
    sources_by_id = {s["id"]: s for s in sources if isinstance(s, dict) and "id" in s}

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
