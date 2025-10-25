import requests
import json
from dotenv import load_dotenv
import os
from flask import Flask, jsonify, request
import asyncio
from dotenv import load_dotenv
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm

from livekit import api
from livekit.plugins import openai, silero
# from livekit.plugins import noise_cancellation, silero
from flask_cors import CORS

app = Flask(__name__)

load_dotenv()

CORS(app, supports_credentials=True)

# Environment variables
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "ws://localhost:7880")

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

@app.route('/api/livekit-token', methods=['POST'])
def create_token():
    """
    Generate a LiveKit access token for a participant to join a room
    
    Expected JSON body:
    {
        "roomName": "my-room",
        "participantName": "john-doe",
        "metadata": "{\"userId\": \"123\"}"  // optional
    }
    """
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        return jsonify({
            "error": "LiveKit credentials not configured"
        }), 500

    try:
        data = request.json
        room_name = data.get('roomName')
        participant_name = data.get('participantName')
        participant_id = data.get('participantId', 'unknown')
        metadata = data.get('metadata', '')

        if not room_name or not participant_name:
            return jsonify({
                "error": "roomName and participantName are required"
            }), 400

        # Create access token
        token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        
        # Set participant identity
        token.with_identity(participant_id)
        
        # Add metadata if provided
        if metadata:
            token.with_metadata(metadata)
        
        # Grant permissions
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,  # Required for chat functionality
        ))
        
        # Generate JWT token
        jwt_token = token.to_jwt()
        
        return jsonify({
            "token": jwt_token,
            "wsUrl": LIVEKIT_URL
        })
    
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "livekit-backend"})


@app.route('/api/rooms/create', methods=['POST'])
def create_room():
    """
    Create a new room (optional - rooms are auto-created on join)
    
    Expected JSON body:
    {
        "roomName": "my-room"
    }
    """
    try:
        data = request.json
        room_name = data.get('roomName')

        if not room_name:
            return jsonify({"error": "roomName is required"}), 400

        livekit_api = api.LiveKitAPI(
            LIVEKIT_URL,
            LIVEKIT_API_KEY,
            LIVEKIT_API_SECRET
        )
        
        # This is async, so we need to handle it differently in Flask
        # For simplicity, rooms are typically auto-created on first join
        
        return jsonify({
            "room": room_name,
            "message": "Room will be created on first join"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/rooms/list', methods=['GET'])
def list_rooms():
    """
    List all active rooms
    Note: This requires async handling, which is complex in Flask
    Consider using FastAPI for this feature or implement with threading
    """
    return jsonify({
        "message": "Use FastAPI version for async room listing",
        "rooms": []
    })


# Optional: Supabase authentication integration
@app.route('/api/livekit-token/authenticated', methods=['POST'])
def create_token_authenticated():
    """
    Protected endpoint for text-only chat
    Users can only send/receive data messages (text chat)
    """
    auth_header = request.headers.get('Authorization')
    
    if not auth_header:
        return jsonify({"error": "No authorization header"}), 401
    
    try:
        # Extract token
        supabase_token = auth_header.replace('Bearer ', '')
        
        data = request.json
        room_name = data.get('roomName')
        participant_name = data.get('participantName')
        participant_id = data.get('participantId', 'unknown')
        
        # Create LiveKit token with LIMITED permissions
        token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        token.with_identity(participant_id)
        token.with_name(participant_name)
        
        # Grant permissions - DISABLED video/audio publishing
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=False,        # DISABLED: Cannot publish video/audio
            can_subscribe=False,      # DISABLED: Cannot subscribe to video/audio
            can_publish_data=True,    # ENABLED: Can send text messages
        ))
        
        return jsonify({
            "token": token.to_jwt(),
            "wsUrl": LIVEKIT_URL
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 401


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(debug=True)