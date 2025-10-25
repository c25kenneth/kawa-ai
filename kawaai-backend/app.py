import requests
import json
from dotenv import load_dotenv
import os
from flask import Flask

app = Flask(__name__)

load_dotenv()

# urls + api_key
url = "https://janitorai.com/hackathon/completions"
api_key = os.getenv("JANITOR_API_KEY")

headers = {
    "Authorization": api_key,
    "Content-Type": "application/json",
}

# System messages
data = {
    "messages": [
        {"role": "user", "content": "Who is Lucy?"}
    ]
}

@app.route('/chat_ai', methods=["POST"])
def chat_ai():
    response = requests.post(url, headers=headers, json=data)

    if response.status_code != 200:
        print(f"Error {response.status_code}: {response.text}")
    else:
        result = response.json()
        # print(result["choices"][0]["message"]["content"])

        return result["choices"][0]["message"]["content"]

if __name__ == '__main__':
    app.run(debug=True)