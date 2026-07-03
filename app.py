"""
AWS Quiz Application - Backend (Flask)
Reads questions from local text file, parses them, and serves a REST API.
"""

import os
import re
import random
from flask import Flask, jsonify, send_from_directory

app = Flask(__name__, static_folder="static")

# ── Path to the questions file ──────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
QUESTIONS_FILE = os.path.join(BASE_DIR, "aws-herramientas-preguntas.txt")

# Also try the file without extension (as discovered on disk)
QUESTIONS_FILE_NO_EXT = os.path.join(BASE_DIR, "aws-herramientas-preguntas")


def load_questions():
    """Read and parse the questions file."""
    # Try both filenames
    filepath = None
    for candidate in [QUESTIONS_FILE, QUESTIONS_FILE_NO_EXT]:
        if os.path.isfile(candidate):
            filepath = candidate
            break

    if filepath is None:
        raise FileNotFoundError(
            f"Questions file not found. Tried:\n"
            f"  {QUESTIONS_FILE}\n"
            f"  {QUESTIONS_FILE_NO_EXT}"
        )

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    questions = []

    # Split into question blocks using the numbered pattern (e.g. "1. ", "10. ")
    # Each block starts with a number followed by a period and space at the start of a line
    blocks = re.split(r"(?=^\d+\.\s)", content, flags=re.MULTILINE)

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        # Extract question number and text
        q_match = re.match(r"^(\d+)\.\s+(.*?)$", block, re.MULTILINE)
        if not q_match:
            continue

        q_number = int(q_match.group(1))
        q_text = q_match.group(2).strip()

        # Extract options: both [X] (correct) and [ ] (incorrect)
        options = []
        correct_index = -1

        option_pattern = re.findall(
            r"\[(X| )\]\s+(.+?)(?=\n\s*\[|\n*$)", block, re.DOTALL
        )

        for idx, (marker, option_text) in enumerate(option_pattern):
            # Clean the option text: remove trailing "(CORRECTA)" / "(Respuesta Correcta)" etc.
            clean_text = re.sub(
                r"\s*\((?:CORRECTA|Respuesta [Cc]orrecta|CORRECTA\s*-\s*.*?)\)\s*$",
                "",
                option_text.strip(),
            )
            # Also remove inline notes like "CORRECTA - Es la afirmación falsa"
            clean_text = re.sub(
                r"\s*\((?:CORRECTA|Respuesta [Cc]orrecta)\s*-\s*.*?\)\s*$",
                "",
                clean_text,
            )
            clean_text = clean_text.strip()

            options.append(clean_text)
            if marker.upper() == "X":
                correct_index = idx

        if options and correct_index >= 0:
            questions.append(
                {
                    "id": q_number,
                    "question": q_text,
                    "options": options,
                    "correct": correct_index,
                }
            )

    return questions


# ── API Routes ──────────────────────────────────────────────────────────────
@app.route("/api/quiz", methods=["GET"])
def get_quiz():
    """Return all questions in random order with shuffled options.
    Re-reads the file on every request so new questions are picked up
    without restarting the server."""
    all_questions = load_questions()

    quiz = []
    shuffled = list(all_questions)
    random.shuffle(shuffled)

    for q in shuffled:
        # Build list of (text, is_correct) pairs, shuffle, then extract new correct index
        indexed_options = [
            (text, idx == q["correct"]) for idx, text in enumerate(q["options"])
        ]
        random.shuffle(indexed_options)

        new_correct = next(
            i for i, (_, is_correct) in enumerate(indexed_options) if is_correct
        )

        quiz.append(
            {
                "id": q["id"],
                "question": q["question"],
                "options": [text for text, _ in indexed_options],
                "correct": new_correct,
            }
        )

    return jsonify({"total": len(quiz), "questions": quiz})


@app.route("/")
def index():
    """Serve the main HTML page."""
    return send_from_directory("static", "index.html")


@app.route("/static/<path:path>")
def serve_static(path):
    """Serve static files (CSS, JS)."""
    return send_from_directory("static", path)


if __name__ == "__main__":
    print("-" * 50)
    print("  AWS Quiz Application")
    print("  Open http://localhost:5000 in your browser")
    print("-" * 50)
    app.run(debug=True, port=5000)
