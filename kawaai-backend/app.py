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
from flask_cors import CORS
from supabase import create_client, Client
import uuid
from uuid import UUID

app = Flask(__name__)

load_dotenv()

CORS(app, supports_credentials=True)

# Environment variables
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "ws://localhost:7880")

# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
        return result["choices"][0]["message"]["content"]


@app.route('/api/rooms/create', methods=['POST'])
def create_room():
    """
    Create a new stream room
    
    Expected JSON body:
    {
        "title": "My Gaming Stream",
        "game": "League of Legends",
        "streamerName": "ProGamer123",
        "userId": "uuid"
    }
    """
    auth_header = request.headers.get('Authorization')
    
    if not auth_header:
        return jsonify({"error": "No authorization header"}), 401
    
    try:
        data = request.json
        title = data.get('title')
        game = data.get('game')
        streamer_name = data.get('streamerName')
        user_id = data.get('userId')
        
        if not all([title, game, streamer_name, user_id]):
            return jsonify({"error": "Missing required fields"}), 400
        
        # Generate unique room ID
        room_id = str(uuid.uuid4())
        
        # Create room in Supabase
        room_data = {
            "id": room_id,
            "title": title,
            "game": game,
            "streamer_name": streamer_name,
            "streamer_id": user_id,
            "is_live": True,
            "viewer_count": 0,
            "created_at": "now()"
        }
        
        result = supabase.table('rooms').insert(room_data).execute()
        
        return jsonify({
            "roomId": room_id,
            "room": result.data[0] if result.data else room_data
        })
    
    except Exception as e:
        print(f"Error creating room: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/rooms/list', methods=['GET'])
def list_rooms():
    """
    List all active rooms
    """
    try:
        result = supabase.table('rooms').select('*').eq('is_live', True).order('created_at', desc=True).execute()
        
        return jsonify({
            "rooms": result.data
        })
    
    except Exception as e:
        print(f"Error listing rooms: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/rooms/past', methods=['GET'])
def get_past_rooms():
    """
    Get all past rooms (non-live)
    """
    try:
        result = supabase.table('rooms').select('*').eq('is_live', False).order('created_at', desc=True).execute()
        return jsonify({"rooms": result.data}), 200
    except Exception as e:
        print(f"Error getting past rooms: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/rooms/<room_id>', methods=['GET'])
def get_room(room_id):
    """
    Get details of a specific room by UUID
    """
    try:
        try:
            UUID(room_id, version=4)
        except ValueError:
            return jsonify({"error": "Invalid room ID"}), 400

        result = supabase.table('rooms').select('*').eq('id', room_id).single().execute()
        
        if not result.data:
            return jsonify({"error": "Room not found"}), 404
        
        return jsonify({"room": result.data}), 200

    except Exception as e:
        print(f"Error getting room: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/rooms/<room_id>/end', methods=['POST'])
def end_room(room_id):
    """
    End a stream room
    """
    auth_header = request.headers.get('Authorization')
    
    if not auth_header:
        return jsonify({"error": "No authorization header"}), 401
    
    try:
        # Update room status
        result = supabase.table('rooms').update({
            "is_live": False,
            "ended_at": "now()"
        }).eq('id', room_id).execute()
        
        return jsonify({
            "message": "Room ended successfully"
        })
    
    except Exception as e:
        print(f"Error ending room: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/livekit-token', methods=['POST'])
def create_token():
    """
    Generate a LiveKit access token for a participant to join a room
    
    Expected JSON body:
    {
        "roomName": "room-uuid",
        "participantName": "john-doe",
        "participantId": "user-uuid",
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
        token.with_name(participant_name)
        
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


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "livekit-backend"})


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(debug=True)