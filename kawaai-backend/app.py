import requests
import json
from dotenv import load_dotenv
import os

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

# actualy call
response = requests.post(url, headers=headers, json=data)

if response.status_code != 200:
    print(f"Error {response.status_code}: {response.text}")
else:
    result = response.json()
    print(result["choices"][0]["message"]["content"])
