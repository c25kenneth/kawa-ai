from dotenv import load_dotenv
load_dotenv()

import asyncio
import os
import json
import pyaudio # Added pyaudio
from livekit import rtc, api

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_ROOM_NAME = os.getenv("LIVEKIT_ROOM_NAME", "my-agent-room")
CLIENT_IDENTITY = os.getenv("CLIENT_IDENTITY", "test-client")
AGENT_IDENTITY = os.getenv("LIVEKIT_PARTICIPANT_IDENTITY", "tts-speaker-agent") # Get agent identity

# Setup PyAudio for playback
p = pyaudio.PyAudio()
audio_stream = None # Will be initialized when audio track is received

async def main():
    global audio_stream # Declare global to modify it

    if not all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
        print("Client: LiveKit credentials not fully set. Please check your .env file.")
        return

    # Generate an access token for the client
    token = (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(CLIENT_IDENTITY)
        .with_name("Test Client")
        .with_grants(api.VideoGrants(room_join=True, room=LIVEKIT_ROOM_NAME, can_publish=True, can_subscribe=True))
        .to_jwt()
    )

    room = rtc.Room()

    @room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        print(f"Client: Participant connected: {participant.identity}")

    @room.on("participant_disconnected")
    def on_participant_disconnected(participant: rtc.RemoteParticipant):
        print(f"Client: Participant disconnected: {participant.identity}")

    @room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.RemoteTrack,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        global audio_stream
        print(f"Client: Track subscribed: {publication.sid} from {participant.identity} of kind {track.kind}")
        if track.kind == rtc.TrackKind.KIND_AUDIO and participant.identity.startswith("agent-"):
            print(f"Client: Subscribing to agent's audio track from {participant.identity}")
            if audio_stream is None:
                try:
                    print("Client: Initializing PyAudio stream...")
                    audio_stream = p.open(
                        format=pyaudio.paInt16,
                        channels=1,
                        rate=48000,
                        output=True
                    )
                    print("Client: PyAudio stream initialized successfully.")
                except Exception as e:
                    print(f"Client: Error initializing PyAudio stream: {e}")
                    return

            print("Client: Starting audio playback task...")
            livekit_audio_stream = rtc.AudioStream(track)
            asyncio.create_task(play_audio_track(livekit_audio_stream, audio_stream))

    async def play_audio_track(livekit_audio_stream: rtc.AudioStream, stream: pyaudio.Stream):
        print("Client: Inside play_audio_track coroutine.")
        try:
            async for frame_event in livekit_audio_stream:
                frame = frame_event.frame
                print(f"Client: Received audio frame with {len(frame.data)} bytes.")
                stream.write(frame.data.tobytes())
        except Exception as e:
            print(f"Client: Error playing audio track: {e}")

    try:
        print(f"Client: Connecting to LiveKit room: {LIVEKIT_ROOM_NAME} at {LIVEKIT_URL}")
        await room.connect(LIVEKIT_URL, token)
        print(f"Client: Connected to room {room.name} as {room.local_participant.identity}")

        # Explicitly dispatch the agent
        lkapi = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        agent_name_to_dispatch = os.getenv("LIVEKIT_PARTICIPANT_IDENTITY", "tts-speaker-agent") # Get agent identity from .env
        print(f"Client: Requesting agent '{agent_name_to_dispatch}' to join room '{LIVEKIT_ROOM_NAME}'...")
        try:
            dispatch = await lkapi.agent_dispatch.create_dispatch(
                api.CreateAgentDispatchRequest(
                    agent_name=agent_name_to_dispatch,
                    room=LIVEKIT_ROOM_NAME,
                    metadata=json.dumps({"triggered_by": CLIENT_IDENTITY}) # Optional metadata
                )
            )
            print(f"Client: Agent dispatch request sent. Dispatch ID: {dispatch.id}")
        except Exception as dispatch_e:
            print(f"Client: Failed to dispatch agent: {dispatch_e}")

        print("Client: Waiting for 20 seconds to observe agent behavior...")
        await asyncio.sleep(20)

    except Exception as e:
        print(f"Client: An error occurred: {e}")
    finally:
        if room.isconnected:
            print("Client: Disconnecting from LiveKit room.")
            await room.disconnect()
        if audio_stream:
            audio_stream.stop_stream()
            audio_stream.close()
        p.terminate() # Terminate PyAudio

if __name__ == "__main__":
    asyncio.run(main())