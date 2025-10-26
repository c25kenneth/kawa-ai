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

# --- USE FLASK ---
app = Flask(__name__)
# Apply CORS
CORS(app)

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

# Environment variables
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
JANITOR_API_KEY = os.getenv("JANITOR_API_KEY")

# --- VALIDATION BLOCK (runs at script start) ---
print("Checking environment variables...")
missing_vars = []
if not LIVEKIT_API_KEY:
    missing_vars.append("LIVEKIT_API_KEY")
if not LIVEKIT_API_SECRET:
    missing_vars.append("LIVEKIT_API_SECRET")
if not LIVEKIT_URL:
    missing_vars.append("LIVEKIT_URL")
if not JANITOR_API_KEY:
    missing_vars.append("JANITOR_API_KEY")

if missing_vars:
    print(f"FATAL ERROR: The following environment variables are not set: {', '.join(missing_vars)}", file=sys.stderr)
    print("Please check your .env file and ensure it is in the same directory as app.py.", file=sys.stderr)
    sys.exit(1)

print("Environment variables loaded successfully.")
# --- END VALIDATION BLOCK ---

def get_clean_http_url():
    """Helper to create the correct HTTP URL for the API client."""
    print(f"  -> Original URL from .env: {LIVEKIT_URL}")
    host_part = LIVEKIT_URL.split('//')[-1].lstrip('/')
    http_scheme = 'https' if 'wss://' in LIVEKIT_URL or 'https://' in LIVEKIT_URL else 'http'
    clean_http_url = f"{http_scheme}://{host_part}"
    print(f"  -> Using clean HTTP URL for API: {clean_http_url}")
    return clean_http_url

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
    NEW APPROACH: Join room as a participant to send data to the agent.
    
    1. Receives text from the client.
    2. Calls the LLM with that text (and requests a stream).
    3. Joins the room as a virtual participant.
    4. Sends each chunk of the LLM's response directly to the room.
    """
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

        # Create a token for the backend to join as a participant
        token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        token.with_identity("backend-sender")
        token.with_name("Backend LLM Sender")
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        ))
        
        jwt_token = token.to_jwt()
        
        # Join the room as a participant
        print(f"Backend joining room '{room_name}' as a participant...")
        room = rtc.Room()
        await room.connect(LIVEKIT_URL, jwt_token)
        print(f"✓ Backend connected to room as participant: {room.local_participant.identity}")

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
                                chat_data = {
                                    "type": "chat",
                                    "text": delta_content
                                }
                                
                                print(f"Sending delta to room: '{delta_content}'")
                                # Send as a PARTICIPANT (this will reach the agent!)
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
        print(f"Error type: {type(e)}", file=sys.stderr)
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

@app.route('/api/livekit-token', methods=['POST'])
async def create_token():
    """
    Generate a LiveKit access token and auto-dispatch an agent
    if the room is empty.
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
        agent_name = 'tts-speaker-agent'

        if not room_name or not participant_name:
            return jsonify({"error": "roomName and participantName are required"}), 400

        # --- AUTO-DISPATCH LOGIC ---
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

# --- Main function ---
if __name__ == '__main__':
    config = hypercorn.config.Config()
    config.bind = ["localhost:5001"]
    config.workers = 1 
    
    print("Starting Hypercorn server on http://localhost:5001 (single worker)")
    
    try:
        asyncio.run(hypercorn.asyncio.serve(app, config))
    except KeyboardInterrupt:
        print("Server stopped.")
    finally:
        print("Shutdown complete.")

