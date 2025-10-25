from fish_audio_sdk import WebSocketSession, TTSRequest
import os 
import pyaudio

# Setup audio playback
p = pyaudio.PyAudio()
stream = p.open(
    format=pyaudio.paInt16,
    channels=1,
    rate=44100,
    output=True
)

# FISH_AUDIO_SECRET_KEY = os.getenv("FISH_API_SECRET_KEY")
FISH_AUDIO_SECRET_KEY = os.getenv("FISH_AUDIO_SECRET_KEY")

PRETTY_GIRL = os.getenv("PRETTY_GIRL")
ENGLISH_FEMALE = os.getenv("ENGLISH_FEMALE")
E_GIRL = os.getenv("E_GIRL")
CHINESE_FEMALE = os.getenv("CHINESE_FEMALE")
SPANISH_FEMALE = os.getenv("SPANISH_FEMALE")
JAPANESE_FEMALE = os.getenv("JAPANESE_FEMALE")

# Create WebSocket session
ws_session = WebSocketSession(FISH_AUDIO_SECRET_KEY)

request = TTSRequest(
    text="",  # Empty for streaming
    reference_id=ENGLISH_FEMALE,
    format="mp3"
)

# Define text generator
def text_stream():
    yield "Sup chat, "
    yield "this is "
    yield "streaming text!"

# Stream and save audio
with ws_session:
    with open("output.mp3", "wb") as f:
        for audio_chunk in ws_session.tts(
            request,  # Empty text for streaming
            text_stream()
        ):
            #f.write(audio_chunk)
            stream.write(audio_chunk)

stream.close()
p.terminate()