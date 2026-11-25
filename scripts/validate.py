"""Validate the question bank.

Step 1 version: loads data/questions.json and data/sources.json and
reports how many entries each holds. Full checks (schema, source ids,
duplicates) are added in Step 2.

Run from the project root:  python3 scripts/validate.py
"""

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_PATH = PROJECT_ROOT / "data" / "questions.json"
SOURCES_PATH = PROJECT_ROOT / "data" / "sources.json"


def load_json_list(path):
    """Load a JSON file that must contain a list; exit with a clear message if not."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        sys.exit(f"Couldn't find {path.relative_to(PROJECT_ROOT)}.")
    except json.JSONDecodeError as error:
        sys.exit(f"{path.relative_to(PROJECT_ROOT)} is not valid JSON: {error}")
    if not isinstance(data, list):
        sys.exit(f"{path.relative_to(PROJECT_ROOT)} must contain a JSON array.")
    return data


def main():
    """Load both data files and print their sizes."""
    questions = load_json_list(QUESTIONS_PATH)
    sources = load_json_list(SOURCES_PATH)
    print(f"Questions: {len(questions)}")
    print(f"Sources:   {len(sources)}")
    print("OK")


if __name__ == "__main__":
    main()
