from dotenv import load_dotenv
load_dotenv()

import asyncio
import os
import pydub
import io
import json
import logging
import re
from livekit import rtc
from livekit.agents import JobContext, Worker, WorkerOptions
from fish_audio_sdk import Session, TTSRequest

# Emoji pattern for removal
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F1E0-\U0001F1FF"  # flags (iOS)
    "\U00002702-\U000027B0"  # dingbats
    "\U000024C2-\U0001F251"  # enclosed characters
    "\U0001F900-\U0001F9FF"  # supplemental symbols
    "\U0001FA00-\U0001FA6F"  # chess symbols
    "\U0001FA70-\U0001FAFF"  # symbols and pictographs extended-a
    "\U00002600-\U000026FF"  # miscellaneous symbols
    "\U00002700-\U000027BF"  # dingbats
    "]+",
    flags=re.UNICODE
)

# --- Configuration from .env ---
FISH_AUDIO_SECRET_KEY = os.getenv("FISH_AUDIO_SECRET_KEY")
ENGLISH_FEMALE = os.getenv("ENGLISH_FEMALE_SOFT")

# --- Helper Functions ---
def strip_emojis(text: str) -> str:
    """Remove all emojis from text for TTS processing."""
    return EMOJI_PATTERN.sub('', text)

# --- LiveKit Agent Logic ---
class TTSSpeakerAgent:
    def __init__(self, job: JobContext):
        self.job = job
        self.room = job.room
        
        # Queues for the pipeline
        self._text_chunk_queue = asyncio.Queue()
        self._sentence_queue = asyncio.Queue()
        
        # Audio source setup
        self.audio_source = rtc.AudioSource(48000, 1)
        self.audio_track = rtc.LocalAudioTrack.create_audio_track("agent-tts-audio", self.audio_source)
        
        # Store the main event loop reference
        self._loop = None
        
        # Text buffering
        self._sentence_enders = re.compile(r'[.!?\n]')
        self._current_sentence_buffer = ""
        
        # Control flags
        self._running = True
        
        print(f"DEBUG: Agent initialized with reference_id: {ENGLISH_FEMALE}")

    def _on_participant_connected(self, participant: rtc.RemoteParticipant):
        print(f"👤 Participant connected: {participant.identity} (SID: {participant.sid})")
        print(f"   Total participants now: {len(self.room.remote_participants) + 1}")

    def _on_participant_disconnected(self, participant: rtc.RemoteParticipant):
        print(f"👤 Participant disconnected: {participant.identity}")
        print(f"   Total participants now: {len(self.room.remote_participants) + 1}")

    def _on_data_received(self, data: rtc.DataPacket):
        """Handle incoming data packets from the backend."""
        async def _process_data():
            try:
                text = data.data.decode("utf-8")
                json_data = json.loads(text)
                
                if "text" in json_data:
                    text_chunk = json_data["text"]
                    # Strip emojis before processing
                    text_chunk = strip_emojis(text_chunk)
                    if text_chunk.strip():  # Only queue if there's text left after stripping
                        await self._text_chunk_queue.put(text_chunk)
                elif json_data.get("type") == "flush":
                    await self._text_chunk_queue.put({"type": "flush"})
                else:
                    logging.warning(f"Received unknown JSON data: {json_data}")
            except Exception as e:
                logging.error(f"Error processing received data: {e}")
        
        asyncio.create_task(_process_data())

    async def start(self):
        """Start the agent's main pipelines."""
        # Store the event loop reference
        self._loop = asyncio.get_running_loop()
        
        print("Setting up event listeners...")
        self.room.on("participant_connected", self._on_participant_connected)
        self.room.on("participant_disconnected", self._on_participant_disconnected)
        self.room.on("data_received", self._on_data_received)
        print("Event listeners set up.")

        print(f"Agent connected to room {self.room.name}")
        print(f"🔑 AGENT IDENTITY: {self.room.local_participant.identity}")
        print(f"🔑 AGENT SID: {self.room.local_participant.sid}")
        
        # List all participants in the room
        print(f"📋 Participants in room:")
        for participant in self.room.remote_participants.values():
            print(f"   - {participant.identity} (SID: {participant.sid})")

        try:
            await self.room.local_participant.publish_track(self.audio_track)
            print("✓ Published audio track for TTS")
        except Exception as e:
            print(f"✗ Error publishing audio track: {e}")
            return

        # Start the pipeline tasks
        text_task = asyncio.create_task(self._text_buffering_pipeline())
        tts_task = asyncio.create_task(self._tts_pipeline())
        
        # Wait for all tasks to complete
        try:
            await asyncio.gather(text_task, tts_task)
        except Exception as e:
            logging.error(f"Error in agent pipelines: {e}")
        
        print("All agent pipelines stopped.")

    async def _self_test_mode(self):
        """
        Self-test mode: If no data is received within 5 seconds, 
        automatically test the TTS pipeline with sample text.
        """
        print("🧪 Self-test mode: Waiting 5 seconds for data from backend...")
        await asyncio.sleep(5)
        
        # Check if any text has been queued
        if self._text_chunk_queue.qsize() == 0:
            print("⚠️  No data received from backend after 5 seconds!")
            print("🧪 Starting self-test to verify TTS pipeline works...")
            
            test_sentences = [
                "Hello, this is a test.",
                "The TTS pipeline is working!",
                "If you hear this, the agent is functioning correctly."
            ]
            
            for sentence in test_sentences:
                print(f"🧪 Self-test: Sending '{sentence}'")
                await self._text_chunk_queue.put(sentence)
                await asyncio.sleep(0.5)
            
            # Send flush to complete
            await self._text_chunk_queue.put({"type": "flush"})
            print("🧪 Self-test complete! If you heard audio, the TTS works.")
            print("   → The issue is likely with data packet delivery from backend.")
        else:
            print("✓ Data received from backend, skipping self-test.")

    async def cleanup(self):
        """Called by the agent worker when the job is ending."""
        print("Agent cleaning up...")
        self._running = False
        
        # Signal all queues to stop
        try:
            await asyncio.wait_for(self._text_chunk_queue.put({"type": "stop"}), timeout=1.0)
            await asyncio.wait_for(self._sentence_queue.put(None), timeout=1.0)
        except asyncio.TimeoutError:
            print("Timeout while signaling queues to stop")
        
        # Disconnect from room
        await self.room.disconnect()
        print("Cleanup complete.")

    async def _text_buffering_pipeline(self):
        """
        Reads text chunks and builds complete sentences.
        Flushes buffer on flush signal or when sentence-ending punctuation is detected.
        """
        print("✓ Text buffering pipeline started")
        
        try:
            while self._running:
                chunk = await self._text_chunk_queue.get()
                
                # Handle control signals
                if isinstance(chunk, dict):
                    if chunk.get("type") == "flush":
                        if self._current_sentence_buffer.strip():
                            print(f"Flushing buffer: '{self._current_sentence_buffer.strip()}'")
                            await self._sentence_queue.put(self._current_sentence_buffer.strip())
                            self._current_sentence_buffer = ""
                        continue
                    elif chunk.get("type") == "stop":
                        if self._current_sentence_buffer.strip():
                            await self._sentence_queue.put(self._current_sentence_buffer.strip())
                        await self._sentence_queue.put(None)
                        break
                
                # Add chunk to buffer
                if isinstance(chunk, str):
                    self._current_sentence_buffer += chunk
                    
                    # Check for complete sentences
                    while True:
                        match = self._sentence_enders.search(self._current_sentence_buffer)
                        if not match:
                            break
                        
                        # Extract complete sentence
                        end_pos = match.end()
                        sentence = self._current_sentence_buffer[:end_pos].strip()
                        
                        if sentence:
                            print(f"→ Sentence ready: '{sentence}'")
                            await self._sentence_queue.put(sentence)
                        
                        # Remove processed sentence from buffer
                        self._current_sentence_buffer = self._current_sentence_buffer[end_pos:].lstrip()
        
        except Exception as e:
            logging.error(f"Error in text buffering pipeline: {e}")
            await self._sentence_queue.put(None)
        
        print("Text buffering pipeline stopped")

    async def _tts_pipeline(self):
        """
        Takes complete sentences and sends them to Fish Audio API for TTS conversion.
        Uses asyncio.to_thread to run blocking Fish Audio SDK calls.
        """
        print("✓ TTS pipeline started")
        
        try:
            while self._running:
                text = await self._sentence_queue.get()
                
                if text is None:
                    break
                
                print(f"🎤 Generating speech: '{text[:50]}{'...' if len(text) > 50 else ''}'")
                
                try:
                    await self._generate_and_play_audio(text)
                    print(f"✓ Finished playing audio")
                except Exception as e:
                    logging.error(f"Error generating TTS: {e}")
        
        except Exception as e:
            logging.error(f"Error in TTS pipeline: {e}")
        
        print("TTS pipeline stopped")

    async def _generate_and_play_audio(self, text: str):
        """
        Generate audio from text using Fish Audio SDK and play it immediately.
        This is the simplest approach that avoids complex threading issues.
        """
        try:
            # Run the blocking Fish Audio SDK call in a thread pool
            audio_data = await asyncio.to_thread(self._call_fish_audio_sync, text)
            
            if not audio_data:
                print(f"✗ No audio data received for: '{text}'")
                return
            
            print(f"✓ Received {len(audio_data)} bytes of audio data")
            
            # Process and play the audio
            await self._process_and_play_audio(audio_data)
            
        except Exception as e:
            logging.error(f"Error in audio generation: {e}")
            raise

    def _call_fish_audio_sync(self, text: str) -> bytes:
        """
        Synchronous function to call Fish Audio API.
        Returns the complete audio data as bytes.
        """
        try:
            # Create a fresh session for this request
            session = Session(FISH_AUDIO_SECRET_KEY)
            
            tts_request = TTSRequest(
                text=text,
                reference_id=ENGLISH_FEMALE,
                format="mp3"
            )
            
            # Collect all audio chunks
            audio_chunks = []
            for chunk in session.tts(tts_request):
                if chunk:
                    audio_chunks.append(chunk)
            
            # Combine all chunks
            audio_data = b''.join(audio_chunks)
            
            return audio_data
            
        except Exception as e:
            logging.error(f"Error calling Fish Audio API: {e}")
            return b''

    async def _process_and_play_audio(self, audio_data: bytes):
        """
        Convert MP3 audio data to PCM and play it through LiveKit.
        """
        try:
            # Decode MP3 to PCM using pydub
            audio_segment = pydub.AudioSegment.from_file(
                io.BytesIO(audio_data),
                format="mp3"
            )
            
            # Resample to 48kHz mono 16-bit (LiveKit format)
            audio_segment = (
                audio_segment.set_frame_rate(48000)
                .set_channels(1)
                .set_sample_width(2)
            )
            
            # Get the raw PCM data
            pcm_data = audio_segment.raw_data
            
            # Split into chunks for streaming (20ms chunks at 48kHz = 960 samples)
            # Each sample is 2 bytes (16-bit), so 1920 bytes per chunk
            chunk_size = 1920
            
            for i in range(0, len(pcm_data), chunk_size):
                chunk = pcm_data[i:i + chunk_size]
                
                # Calculate samples per channel for this chunk
                samples_per_channel = len(chunk) // 2  # 2 bytes per sample (16-bit)
                
                # Create LiveKit AudioFrame
                frame = rtc.AudioFrame(
                    data=chunk,
                    sample_rate=48000,
                    num_channels=1,
                    samples_per_channel=samples_per_channel
                )
                
                # Play the frame
                await self.audio_source.capture_frame(frame)
            
        except pydub.exceptions.CouldntDecodeError as e:
            logging.error(f"Could not decode audio: {e}")
        except Exception as e:
            logging.error(f"Error processing audio: {e}")


async def _run_agent(job: JobContext):
    """Entry point for the agent worker."""
    print("Job received, creating agent...")
    agent = TTSSpeakerAgent(job)

    print("Connecting to the room...")
    try:
        await job.connect()
        print("Successfully connected to the room.")
    except Exception as e:
        print(f"Failed to connect to the room: {e}")
        return

    try:
        await agent.start()
    except Exception as e:
        print(f"Unhandled error in agent.start(): {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("Job finished, running cleanup...")
        await agent.cleanup()


async def main():
    """Main entry point for the agent worker."""
    print("Starting LiveKit Agent Worker...")
    print(f"Fish Audio API Key: {FISH_AUDIO_SECRET_KEY[:10]}..." if FISH_AUDIO_SECRET_KEY else "✗ Missing API Key")
    print(f"English Female Voice ID: {ENGLISH_FEMALE}")
    
    worker = Worker(WorkerOptions(entrypoint_fnc=_run_agent))
    await worker.run()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    logging.getLogger('livekit').setLevel(logging.INFO)
    logging.getLogger('pydub').setLevel(logging.WARNING)
    
    asyncio.run(main())
