import os
import io
import json
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
import PyPDF2
import certifi
import anthropic
from datetime import datetime, timezone
from pymongo import MongoClient

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

mongo = MongoClient(os.getenv("MONGODB_URI"), tlsCAFile=certifi.where(), ssl=True, tlsAllowInvalidCertificates=True)
submissions = mongo["resuready"]["submissions"]
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """You are ResuReady, a friendly and expert resume coach specializing in helping college students and early-career applicants land their first or second job. You give honest, specific, and actionable feedback.

You will receive a user profile and their resume text. Analyze the resume thoroughly using the following steps:

<steps>
1. OVERALL RATING: Assign one of three ratings — "Strong", "Average", or "Needs Work" — based on clarity, relevance, formatting quality (inferred from text), impact of bullet points, and alignment with the stated industry and experience level.

2. SECTION FEEDBACK: Evaluate each major section present in the resume (e.g., Education, Experience, Projects, Skills, Summary). For each section, provide a short score label ("Strong", "Average", or "Needs Work") and 2-3 sentences of specific feedback.

3. KEYWORD GAPS: Identify industry-relevant keywords that are present in the resume and important ones that are missing for the stated industry and role level.

4. BULLET REWRITES: Select up to 3 weak or vague bullet points from the resume and rewrite them to be more impactful using strong action verbs and quantifiable results where possible.

5. TOP PRIORITIES: List exactly 3 specific, actionable improvements the user should make first, ordered by impact.
</steps>

<output_constraints>
- Respond with ONLY valid JSON. No markdown, no explanation, no preamble.
- Use exactly this schema:
{
  "overall_rating": "Strong" | "Average" | "Needs Work",
  "summary": "2-3 sentence overall assessment",
  "section_feedback": [
    {
      "section": "section name",
      "score": "Strong" | "Average" | "Needs Work",
      "feedback": "specific feedback"
    }
  ],
  "keywords": {
    "present": ["keyword1", "keyword2"],
    "missing": ["keyword3", "keyword4"]
  },
  "rewrites": [
    {
      "original": "original bullet text",
      "improved": "improved bullet text"
    }
  ],
  "top_priorities": ["priority 1", "priority 2", "priority 3"]
}
- The top_priorities array must contain exactly 3 strings.
- The rewrites array must contain 1 to 3 items.
- Do not include any text outside the JSON object.
</output_constraints>"""


def build_prompt(name, industry, years_of_experience, resume_text):
    return f"""<user_profile>
Name: {name}
Industry: {industry}
Years of Experience: {years_of_experience}
</user_profile>

<resume>
{resume_text}
</resume>

Please analyze this resume and return your feedback as JSON following the schema in your instructions."""


def extract_pdf_text(file_bytes):
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text.strip()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    name = request.form.get("name", "").strip()
    industry = request.form.get("industry", "").strip()
    years_of_experience = request.form.get("years_of_experience", "").strip()
    resume_file = request.files.get("resume")

    if not all([name, industry, years_of_experience, resume_file]):
        return jsonify({"error": "All fields are required."}), 400

    if not resume_file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Please upload a PDF file."}), 400

    try:
        file_bytes = resume_file.read()
        resume_text = extract_pdf_text(file_bytes)
    except Exception:
        return jsonify({"error": "Could not read PDF. Please ensure it is a valid PDF file."}), 400

    if not resume_text:
        return jsonify({"error": "No text found in PDF. Please ensure your PDF is not an image scan."}), 400

    try:
        message = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=2048,
            thinking={"type": "adaptive"},
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": build_prompt(name, industry, years_of_experience, resume_text),
                }
            ],
        )
    except anthropic.APIError as e:
        return jsonify({"error": f"AI service error: {str(e)}"}), 502

    raw_response = ""
    for block in message.content:
        if block.type == "text":
            raw_response = block.text
            break

    try:
        feedback = json.loads(raw_response)
    except json.JSONDecodeError:
        return jsonify({"error": "Failed to parse AI response. Please try again."}), 500

    try:
        submissions.insert_one(
            {
                "name": name,
                "industry": industry,
                "years_of_experience": years_of_experience,
                "resume_text": resume_text[:10000],
                "resume_filename": resume_file.filename,
                "feedback": feedback,
                "created_at": datetime.now(timezone.utc),
            }
        )
    except Exception as e:
        app.logger.error("MongoDB insert failed: %s", e)
        print(f"MongoDB insert failed: {e}")

    return jsonify(feedback)


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
