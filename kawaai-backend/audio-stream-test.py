from fish_audio_sdk import WebSocketSession, TTSRequest
import os 

FISH_AUDIO_SECRET_KEY = os.getenv("FISH_API_SECRET_KEY")

# Create WebSocket session
ws_session = WebSocketSession(FISH_AUDIO_SECRET_KEY)
model_id = ""


request = TTSRequest(
    text="",  # Empty for streaming
    reference_id="your_model_id",
    format="mp3"
)

# Define text generator
def text_stream():
    yield "Hello, "
    yield "this is "
    yield "streaming text!"

# Stream and save audio
with ws_session:
    with open("output.mp3", "wb") as f:
        for audio_chunk in ws_session.tts(
            TTSRequest(text=""),  # Empty text for streaming
            text_stream()
        ):
            f.write(audio_chunk)