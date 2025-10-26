import json
from dotenv import load_dotenv
import os
from flask import Flask, jsonify, request
from livekit import api, rtc
from livekit.protocol.models import DataPacket
from flask_cors import CORS
import asyncio
import hypercorn.asyncio
import hypercorn.config
import httpx
import sys
from supabase import create_client, Client
import uuid
from uuid import UUID
import re

# --- FLASK APP SETUP ---
app = Flask(__name__)
CORS(app, supports_credentials=True)

load_dotenv()

# --- ENVIRONMENT VARIABLES ---
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
JANITOR_API_KEY = os.getenv("JANITOR_API_KEY")

# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# --- HELPER FUNCTIONS ---
def strip_markdown(text: str) -> str:
    """
    Strip markdown formatting for TTS processing.
    Removes: bold, italic, code, links, headers, lists, etc.
    """
    if not text:
        return text
    
    # Remove code blocks (```code```)
    text = re.sub(r'```[\s\S]*?```', '', text)
    
    # Remove inline code (`code`)
    text = re.sub(r'`[^`]+`', '', text)
    
    # Remove links [text](url) - keep the text part
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    
    # Remove bold/italic (**, *, __, _)
    text = re.sub(r'\*\*([^\*]+)\*\*', r'\1', text)  # **bold**
    text = re.sub(r'\*([^\*]+)\*', r'\1', text)      # *italic*
    text = re.sub(r'__([^_]+)__', r'\1', text)       # __bold__
    text = re.sub(r'_([^_]+)_', r'\1', text)         # _italic_
    
    # Remove headers (# ## ###)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    
    # Remove list markers (- * +)
    text = re.sub(r'^[\*\-\+]\s+', '', text, flags=re.MULTILINE)
    
    # Remove blockquotes (>)
    text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)
    
    # Remove horizontal rules (---, ***)
    text = re.sub(r'^[\-\*]{3,}$', '', text, flags=re.MULTILINE)
    
    # Remove HTML tags (just in case)
    text = re.sub(r'<[^>]+>', '', text)
    
    # Clean up multiple spaces
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()

# --- VALIDATION BLOCK ---
print("Checking environment variables...")
missing_vars = []
if not LIVEKIT_API_KEY:
    missing_vars.append("LIVEKIT_API_KEY")
if not LIVEKIT_API_SECRET:
    missing_vars.append("LIVEKIT_API_SECRET")
if not LIVEKIT_URL:
    missing_vars.append("LIVEKIT_URL")

if missing_vars:
    print(f"FATAL ERROR: The following environment variables are not set: {', '.join(missing_vars)}", file=sys.stderr)
    print("Please check your .env file and ensure it is in the same directory as app.py.", file=sys.stderr)
    sys.exit(1)

if not JANITOR_API_KEY:
    print("WARNING: JANITOR_API_KEY not set - /chat endpoint will not work", file=sys.stderr)

if not supabase:
    print("WARNING: Supabase credentials not set - room management endpoints will not work", file=sys.stderr)

print("Environment variables loaded successfully.")

# --- HELPER FUNCTIONS ---
def get_clean_http_url():
    """Helper to create the correct HTTP URL for the API client."""
    host_part = LIVEKIT_URL.split('//')[-1].lstrip('/')
    http_scheme = 'https' if 'wss://' in LIVEKIT_URL or 'https://' in LIVEKIT_URL else 'http'
    clean_http_url = f"{http_scheme}://{host_part}"
    return clean_http_url


# =============================================================================
# ROOM MANAGEMENT ENDPOINTS (from merge_app.py)
# =============================================================================

@app.route('/api/rooms/create', methods=['POST'])
def create_room():
    """
    Create a new stream room
    
    Expected JSON body:
    {
        "title": "My Gaming Stream",
        "game": "League of Legends",
        "streamerName": "ProGamer123",
        "userId": "uuid",
        "youtubeVideoId": "dQw4w9WgXcQ",  # optional
        "live2dModel": {...}  # optional
    }
    """
    if not supabase:
        return jsonify({"error": "Room management not configured (Supabase missing)"}), 500
    
    auth_header = request.headers.get('Authorization')
    
    if not auth_header:
        return jsonify({"error": "No authorization header"}), 401
    
    try:
        data = request.json
        title = data.get('title')
        game = data.get('game')
        streamer_name = data.get('streamerName')
        user_id = data.get('userId')
        youtube_video_id = data.get('youtubeVideoId')
        live2d_model = data.get('live2dModel')
        
        if not all([title, game, streamer_name, user_id]):
            return jsonify({"error": "Missing required fields"}), 400
        
        # DEV MODE: Ensure user exists (create if needed for dev user)
        if user_id == '00000000-0000-0000-0000-000000000000':
            try:
                print(f"DEBUG: Checking if dev user exists...")
                # Check if dev user exists
                existing = supabase.table('users').select('id').eq('id', user_id).execute()
                print(f"DEBUG: Query result: {existing.data}")
                
                if not existing.data or len(existing.data) == 0:
                    print(f"DEBUG: Dev user not found, creating...")
                    # Create dev user - try different column combinations
                    try:
                        result = supabase.table('users').insert({
                            'id': user_id,
                            'email': 'dev@example.com',
                            'username': 'DevUser'
                        }).execute()
                        print(f"✓ Created dev user in database: {result.data}")
                    except Exception as insert_error:
                        print(f"DEBUG: First insert failed: {insert_error}")
                        # Try with minimal fields
                        result = supabase.table('users').insert({
                            'id': user_id,
                        }).execute()
                        print(f"✓ Created dev user with minimal fields: {result.data}")
                else:
                    print(f"DEBUG: Dev user already exists")
            except Exception as e:
                print(f"ERROR creating dev user: {e}")
                import traceback
                traceback.print_exc()
        
        # Generate unique room ID
        room_id = str(uuid.uuid4())
        
        # Create room in Supabase
        room_data = {
            "id": room_id,
            "title": title,
            "game": game,
            "streamer_name": streamer_name,
            "streamer_id": user_id,
            "youtube_video_id": youtube_video_id,
            "live2d_model": live2d_model,
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
    """List all active rooms"""
    if not supabase:
        return jsonify({"error": "Room management not configured"}), 500
    
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
    """Get all past rooms (non-live)"""
    if not supabase:
        return jsonify({"error": "Room management not configured"}), 500
    
    try:
        result = supabase.table('rooms').select('*').eq('is_live', False).order('created_at', desc=True).execute()
        return jsonify({"rooms": result.data}), 200
    except Exception as e:
        print(f"Error getting past rooms: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/rooms/<room_id>', methods=['GET'])
def get_room(room_id):
    """Get details of a specific room by UUID"""
    if not supabase:
        return jsonify({"error": "Room management not configured"}), 500
    
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
    """End a stream room"""
    if not supabase:
        return jsonify({"error": "Room management not configured"}), 500
    
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


# =============================================================================
# TTS AGENT ENDPOINTS (from working app.py)
# =============================================================================

@app.route('/dispatch-agent', methods=["POST"])
async def dispatch_agent():
    """
    Dispatches the TTS agent to a specified room.
    """
    data = request.json
    room_name = data.get('room_name')
    agent_name = data.get('agent_name', 'tts-speaker-agent')

    if not room_name:
        return jsonify({"error": "room_name is required"}), 400

    lkapi = None
    try:
        lkapi = api.LiveKitAPI(get_clean_http_url(), LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        
        print(f"Attempting to dispatch agent '{agent_name}' to room '{room_name}'")
        dispatch = await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name=agent_name,
                room=room_name
            )
        )
        print(f"Agent dispatch successful, ID: {dispatch.id}")
        return jsonify({"message": f"Agent {agent_name} dispatched to room {room_name}", "dispatch_id": dispatch.id})
    except Exception as e:
        print(f"Error dispatching agent: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500
    finally:
        if lkapi:
            await lkapi.aclose()


@app.route('/chat', methods=["POST"])
async def chat():
    """
    TTS-ENABLED CHAT: Streams LLM response to TTS agent for audio output
    
    Backend joins room as participant and sends LLM stream to TTS agent.
    Auto-dispatches agent if not already in room.
    
    Expected JSON body:
    {
        "room_name": "room-uuid",
        "text": "Hello, how are you?"
    }
    """
    if not JANITOR_API_KEY:
        return jsonify({"error": "JANITOR_API_KEY not configured"}), 500
    
    data = request.json
    room_name = data.get('room_name')
    text = data.get('text')

    if not room_name or not text:
        return jsonify({"error": "room_name and text are required"}), 400

    url = "https://janitorai.com/hackathon/completions"
    headers = {
        "Authorization": JANITOR_API_KEY,
        "Content-Type": "application/json",
    }
    llm_data = {
        "messages": [{"role": "user", "content": text}],
        "stream": True
    }
    
    lkapi = None
    http_client = None
    room = None
    
    try:
        lkapi = api.LiveKitAPI(get_clean_http_url(), LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        http_client = httpx.AsyncClient()

        # --- VERIFY ROOM EXISTS ---
        try:
            rooms_list = await lkapi.room.list_rooms(api.ListRoomsRequest())
            room_exists = any(r.name == room_name for r in rooms_list.rooms)
            
            if not room_exists:
                print(f"⚠️  Room '{room_name}' doesn't exist, creating it...")
                # Room will be created automatically when first participant joins
        except Exception as e:
            print(f"Note: Could not verify room existence: {e}")

        # --- ENSURE AGENT IS IN ROOM ---
        # Check if TTS agent is already in the room
        try:
            participants_response = await lkapi.room.list_participants(
                api.ListParticipantsRequest(room=room_name)
            )
            
            # Check if agent is in the room
            agent_present = any(
                p.identity.startswith('agent-') for p in participants_response.participants
            )
            
            if not agent_present:
                print(f"TTS agent not found in room '{room_name}'. Dispatching...")
                await lkapi.agent_dispatch.create_dispatch(
                    api.CreateAgentDispatchRequest(
                        agent_name='tts-speaker-agent',
                        room=room_name
                    )
                )
                print(f"✓ TTS agent dispatched to room '{room_name}'")
                # Give agent time to connect
                await asyncio.sleep(2)
            else:
                print(f"✓ TTS agent already in room '{room_name}'")
                
        except Exception as e:
            print(f"Warning: Could not check/dispatch agent: {e}", file=sys.stderr)
        # --- END AGENT CHECK ---

        # NOTE: There's a persistent "backend-sender" created by the agent for monitoring,
        # but we use "llm-sender" here to actually send data (agents can only receive from participants, not server API).
        
        # Create token to join as llm-sender participant
        token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        token.with_identity("llm-sender")
        token.with_name("LLM Data Sender")
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish_data=True,
        ))
        jwt_token = token.to_jwt()
        
        # Join room as participant
        room = rtc.Room()
        await room.connect(LIVEKIT_URL, jwt_token)
        print(f"✓ Backend joined room as 'llm-sender'")
        await asyncio.sleep(0.5)  # Stabilize

        print(f"Sending streaming request to JLLM: '{text}'")
        
        full_llm_response = ""
        buffer = ""

        async with http_client.stream("POST", url, headers=headers, json=llm_data, timeout=None) as response:
            response.raise_for_status()
            
            async for chunk in response.aiter_bytes():
                buffer += chunk.decode('utf-8')
                
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    
                    if line.startswith("data:"):
                        json_str = line[len("data:"):].strip()
                        if not json_str:
                            continue
                            
                        try:
                            json_data = json.loads(json_str)
                            delta_content = json_data.get("choices", [{}])[0].get("delta", {}).get("content")
                            
                            if delta_content:
                                full_llm_response += delta_content
                                
                                # Strip markdown formatting for TTS
                                cleaned_text = strip_markdown(delta_content)
                                
                                if cleaned_text.strip():  # Only send if there's text left after stripping
                                    chat_data = {
                                        "type": "chat",
                                        "text": cleaned_text
                                    }
                                    
                                    # Send as llm-sender participant
                                    await room.local_participant.publish_data(
                                        json.dumps(chat_data).encode('utf-8'),
                                        reliable=True
                                    )

                        except json.JSONDecodeError:
                            print(f"Warning: Could not decode JSON from line: {json_str}", file=sys.stderr)
                    
            if buffer.strip():
                print(f"Warning: Unprocessed buffer at end of stream: {buffer.strip()}", file=sys.stderr)

        # Send FLUSH packet
        print("LLM stream finished. Sending FLUSH packet.")
        await room.local_participant.publish_data(
            json.dumps({"type": "flush"}).encode('utf-8'),
            reliable=True
        )

        print(f"Full response from JLLM: '{full_llm_response}'")
        
        # Disconnect from room
        await room.disconnect()
        
        return jsonify({"message": "Chat stream sent to agent.", "full_response": full_llm_response})

    except httpx.HTTPStatusError as e:
        print(f"LLM request failed with status {e.response.status_code}: {e.response.text}", file=sys.stderr)
        return jsonify({"error": f"LLM request failed: {e.response.status_code}", "details": str(e.response.text)}), 500
    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if room and room.isconnected:
            await room.disconnect()
        if lkapi:
            await lkapi.aclose()
        if http_client:
            await http_client.aclose()


# =============================================================================
# TOKEN GENERATION ENDPOINTS
# =============================================================================

@app.route('/api/livekit-token', methods=['POST'])
async def create_token():
    """
    Generate a LiveKit access token with optional auto-dispatch of TTS agent
    
    Expected JSON body:
    {
        "roomName": "room-uuid",
        "participantName": "john-doe",
        "participantId": "user-uuid",  # optional
        "metadata": "{...}",  # optional
        "autoDispatchAgent": false  # optional, default true
    }
    """
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        return jsonify({"error": "LiveKit credentials not configured"}), 500

    lkapi = None
    try:
        lkapi = api.LiveKitAPI(get_clean_http_url(), LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        
        data = request.json
        room_name = data.get('roomName')
        participant_name = data.get('participantName')
        participant_id = data.get('participantId', 'unknown')
        metadata = data.get('metadata', '')
        auto_dispatch = data.get('autoDispatchAgent', True)
        agent_name = 'tts-speaker-agent'

        if not room_name or not participant_name:
            return jsonify({"error": "roomName and participantName are required"}), 400

        # --- AUTO-DISPATCH LOGIC (optional) ---
        if auto_dispatch:
            try:
                participants_response = await lkapi.room.list_participants(
                    api.ListParticipantsRequest(room=room_name)
                )
                
                if not participants_response.participants:
                    print(f"Room '{room_name}' is empty. Dispatching agent '{agent_name}'...")
                    await lkapi.agent_dispatch.create_dispatch(
                        api.CreateAgentDispatchRequest(
                            agent_name=agent_name,
                            room=room_name
                        )
                    )
                    print(f"Agent '{agent_name}' dispatched to room '{room_name}'.")
                else:
                    print(f"Room '{room_name}' is not empty, agent dispatch skipped.")

            except Exception as e:
                print(f"Warning: Auto-dispatch of agent failed: {e}", file=sys.stderr)
        # --- END AUTO-DISPATCH LOGIC ---

        # Create the token
        token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        token.with_identity(participant_id)
        if metadata:
            token.with_metadata(metadata)
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        ))
        
        jwt_token = token.to_jwt()
        
        return jsonify({
            "token": jwt_token,
            "wsUrl": LIVEKIT_URL
        })
    
    except Exception as e:
        print(f"Error in create_token: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500
    finally:
        if lkapi:
            await lkapi.aclose()


@app.route('/api/livekit-token/authenticated', methods=['POST'])
def create_token_authenticated():
    """
    Protected endpoint for text-only chat (no video/audio publishing)
    Users can only send/receive data messages (text chat)
    
    Requires Authorization header with Supabase token
    """
    auth_header = request.headers.get('Authorization')
    
    if not auth_header:
        return jsonify({"error": "No authorization header"}), 401
    
    try:
        data = request.json
        room_name = data.get('roomName')
        participant_name = data.get('participantName')
        participant_id = data.get('participantId', 'unknown')
        
        # Create LiveKit token with LIMITED permissions
        token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        token.with_identity(participant_id)
        token.with_name(participant_name)
        
        # Grant permissions - DISABLED video/audio publishing but ENABLED audio subscribing
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=False,        # DISABLED: Cannot publish video/audio
            can_subscribe=True,       # ENABLED: Can hear TTS agent audio
            can_publish_data=True,    # ENABLED: Can send text messages
        ))
        
        return jsonify({
            "token": token.to_jwt(),
            "wsUrl": LIVEKIT_URL
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 401


# =============================================================================
# UTILITY ENDPOINTS
# =============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "service": "livekit-backend-merged",
        "features": {
            "room_management": supabase is not None,
            "tts_agent": JANITOR_API_KEY is not None
        }
    })


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error"}), 500


# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    config = hypercorn.config.Config()
    config.bind = ["localhost:5001"]
    config.workers = 1 
    
    print("="*60)
    print("Starting Merged Backend Server")
    print("="*60)
    print(f"✓ LiveKit URL: {LIVEKIT_URL}")
    print(f"✓ Room Management: {'Enabled' if supabase else 'Disabled (Supabase not configured)'}")
    print(f"✓ TTS Agent: {'Enabled' if JANITOR_API_KEY else 'Disabled (JANITOR_API_KEY not set)'}")
    print(f"✓ Server: http://localhost:5001")
    print("="*60)
    
    try:
        asyncio.run(hypercorn.asyncio.serve(app, config))
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        print("Shutdown complete.")

