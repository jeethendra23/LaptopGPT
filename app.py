
import os
import json
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = Flask(__name__)

api_key = os.getenv("GROQ_API_KEY")
model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

client = OpenAI(
    api_key=api_key,
    base_url="https://api.groq.com/openai/v1"
) if api_key else None


SYSTEM_PROMPT = """
You are LaptopGPT, an AI assistant that specializes exclusively in laptops.

STRICT TOPIC RULE:
Answer ONLY questions related to laptops and laptop technology.

ALLOWED TOPICS:
- Laptop recommendations and comparisons
- Laptop brands and models
- Intel and AMD processors
- RAM, SSDs and graphics cards
- Gaming, student and office laptops
- Laptop prices and specifications
- Laptop repairs and troubleshooting
- Batteries, chargers and displays
- Laptop upgrades and performance
- Laptop-related software and programming

UNRELATED QUESTIONS:
Politely refuse questions about smartphones, stock markets,
IPOs, politics, sports, entertainment and unrelated topics.

CHART GENERATION:
Generate a chart whenever it would genuinely help explain
a laptop-related answer or when the user requests one.

Supported chart types:
- bar
- line
- pie
- doughnut

IMPORTANT DATA RULES:
1. Never invent real laptop sales figures or market-share statistics.
2. If verified sales data is unavailable, explain this in the
   answer and do not create a misleading sales chart.
3. Use reliable specifications when comparing laptop hardware.
4. Clearly label estimated or illustrative comparison values.
5. Use charts only when useful. Otherwise return null.
6. All chart values must be numeric.
7. Use short labels and readable chart titles.

RESPONSE FORMAT:
Return ONLY valid JSON in this structure:

{
  "reply": "Your complete conversational answer in Markdown",
  "chart": null
}

OR when a chart is useful:

{
  "reply": "Your complete conversational answer in Markdown",
  "chart": {
    "type": "bar",
    "title": "Laptop Comparison",
    "labels": ["Option A", "Option B"],
    "datasets": [
      {
        "label": "Performance",
        "data": [80, 90]
      }
    ]
  }
}

IMPORTANT:
- Do not put Markdown code fences around the JSON.
- Always include both reply and chart.
- Use chart: null when no chart is appropriate.
- Never generate charts for unrelated questions.
- Preserve natural, helpful conversational answers.
- Understand follow-up questions using conversation history.
- Explain technical topics simply.
- Use Indian Rupees for budgets.
"""


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():

    if not client:
        return jsonify({
            "reply": "Groq API key is missing. Please check your .env file.",
            "chart": None
        }), 500

    data = request.get_json(silent=True) or {}

    message = data.get("message", "").strip()
    history = data.get("history", [])

    if not message:
        return jsonify({
            "reply": "Please enter a question.",
            "chart": None
        }), 400

    try:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]

        # Avoid sending the latest question twice.
        previous_history = history[-7:-1]

        for item in previous_history:
            sender = item.get("sender")
            text = item.get("text", "")

            if sender == "user" and text:
                messages.append({
                    "role": "user",
                    "content": text
                })

            elif sender == "bot" and text:
                messages.append({
                    "role": "assistant",
                    "content": text
                })

        messages.append({
            "role": "user",
            "content": message
        })

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"}
        )

        result = json.loads(
            response.choices[0].message.content
        )

        reply = result.get(
            "reply",
            "I couldn't generate an answer. Please try again."
        )

        chart = result.get("chart")

        # Validate chart data before sending it to the browser.
        if not isinstance(chart, dict):
            chart = None

        if chart:
            chart_type = chart.get("type")
            labels = chart.get("labels")
            datasets = chart.get("datasets")

            if (
                chart_type not in ["bar", "line", "pie", "doughnut"]
                or not isinstance(labels, list)
                or not isinstance(datasets, list)
                or not labels
                or len(labels) > 20
                or not datasets
                or len(datasets) > 5
            ):
                chart = None

            else:
                valid = True

                for dataset in datasets:
                    values = dataset.get("data") if isinstance(dataset, dict) else None

                    if (
                        not isinstance(values, list)
                        or len(values) != len(labels)
                        or not all(
                            isinstance(value, (int, float))
                            and not isinstance(value, bool)
                            for value in values
                        )
                    ):
                        valid = False
                        break

                if not valid:
                    chart = None

        return jsonify({
            "reply": reply,
            "chart": chart
        })

    except Exception as error:
        print("GROQ ERROR:", error)

        return jsonify({
            "reply": "Sorry, something went wrong. Please check the VS Code Terminal.",
            "chart": None
        }), 500


if __name__ == "__main__":
    app.run(debug=True)
