from dotenv import load_dotenv
load_dotenv()

import asyncio
import os
import pydub
import io
import json

from livekit import rtc, api
from livekit.agents import (                                                                                                                                
    JobContext,                                                                                                                                             
    JobRequest,                                                                                                                                             
    WorkerOptions,                                                                                                                                          
    cli,                                                                                                                                                    
    llm,                                                                                                                                                    
    tts,                                                                                                                                                    
)                                                                                                                                                           
from livekit.agents.utils import AudioBuffer, merge_frames
from livekit.protocol import agent as agent_protocol
from livekit.protocol import models as livekit_models

from fish_audio_sdk import WebSocketSession, TTSRequest

# --- Configuration from .env ---                                                                                                                             
FISH_AUDIO_SECRET_KEY = os.getenv("FISH_AUDIO_SECRET_KEY")
ENGLISH_FEMALE = os.getenv("ENGLISH_FEMALE") # Assuming this is a valid reference_id for Fish Audio

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

# --- LiveKit Agent Logic ---                                                                                                                               

class TTSSpeakerAgent:                                                                                                                                     
    def __init__(self, job: JobContext):                                                                                                                    
        self.job = job                                                                                                                                     
        self.room = job.room      
        self._audio_queue = asyncio.Queue()
        self._loop = asyncio.get_running_loop()
        self.audio_source = rtc.AudioSource(48000, 1) # LiveKit typically works best with 48kHz, 1 channel
        self.audio_track = rtc.LocalAudioTrack.create_audio_track("agent-tts-audio", self.audio_source)
        self.tts_ws_session = WebSocketSession(FISH_AUDIO_SECRET_KEY)

        # This is where you'd typically integrate an LLM for conversational agents
        # For this example, we'll just use a predefined text stream.

        self.room.on("participant_connected", self._on_participant_connected)
        self.room.on("participant_disconnected", self._on_participant_disconnected)

    def _on_participant_connected(self, participant: rtc.RemoteParticipant):
        """Callback for remote participant connections."""
        print(f"Participant connected: {participant.identity}")

    def _on_participant_disconnected(self, participant: rtc.RemoteParticipant):
        """Callback for remote participant disconnections."""
        print(f"Participant disconnected: {participant.identity}")

    async def start(self):
        print(f"Agent connected to room {self.room.name}")
        
        # --- NOW it is safe to publish the track ---
        try:
            await self.room.local_participant.publish_track(self.audio_track)
            print("Published audio track for TTS")
        except Exception as e:
            print(f"Error publishing audio track: {e}")
            return # Can't continue if publishing fails

        # Define text generator
        def text_stream():
            yield "Hello, I am a LiveKit agent streaming audio from Fish Audio SDK. "
            yield "I can also send viseme data for avatar synchronization. "
            yield "This is a demonstration of advanced audio streaming."

        # Prepare TTS request for Fish Audio
        tts_request = TTSRequest(
            text="",  # Empty for streaming
            reference_id=ENGLISH_FEMALE,
            format="mp3"
        )

        # --- Main audio streaming loop ---
        
        # 1. Start the blocking TTS pipeline in a separate thread
        asyncio.create_task(
            self._run_tts_pipeline_in_thread(tts_request, text_stream)
        )

        # 2. In this main async task, listen to the queue
        print("Waiting for audio frames from the queue...")
        while True:
            # Get a frame from the queue (put there by the other thread)
            frame = await self._audio_queue.get()

            # Check for the 'None' signal to end the stream
            if frame is None:
                print("Received end-of-stream signal, stopping capture.")
                break
            
            # If it's a real frame, capture it.
            # This await is now non-blocking and will work correctly.
            await self.audio_source.capture_frame(frame)

        print("Fish Audio SDK stream finished.")

    async def cleanup(self):                                                                                                                                
        print("Agent cleaning up...")                                                                                                                     
        await self.room.disconnect()                                                                                                                        
        self.tts_ws_session.close()   

    async def _run_tts_pipeline_in_thread(self, tts_request, text_stream):
        """
        Runs the blocking TTS pipeline in a separate thread to avoid
        blocking the main asyncio event loop.
        """
        print("Starting TTS pipeline in a separate thread...")
        try:
            # Run the synchronous/blocking method in a thread
            await asyncio.to_thread(
                self._blocking_tts_pipeline, tts_request, text_stream
            )
        except Exception as e:
            print(f"Error running blocking pipeline: {e}")
        finally:
            # Once the thread is done, put None in the queue to signal
            # the 'start' method to stop listening.
            await self._audio_queue.put(None)
            print("TTS pipeline thread finished, end signal queued.")

    def _blocking_tts_pipeline(self, tts_request, text_stream):
        """
        This is the synchronous method that contains all the blocking
        I/O (Fish Audio SDK and pydub processing).
        It runs in a separate thread.
        """
        print("Blocking TTS pipeline thread started.")
        with self.tts_ws_session:
            for audio_chunk in self.tts_ws_session.tts(tts_request, text_stream()):
                if not audio_chunk:
                    print("Received empty audio chunk, skipping.")
                    continue
                
                # print(f"Received audio chunk, size: {len(audio_chunk)}") # Uncomment for deep debugging
                try:
                    # Decode MP3 chunk to raw PCM using pydub
                    audio_segment = pydub.AudioSegment.from_file(io.BytesIO(audio_chunk), format="mp3")

                    # Resample for LiveKit
                    if audio_segment.frame_rate != 48000:
                        audio_segment = audio_segment.set_frame_rate(48000)
                    if audio_segment.channels != 1:
                        audio_segment = audio_segment.set_channels(1)
                    if audio_segment.sample_width != 2:
                        audio_segment = audio_segment.set_sample_width(2)

                    # Create LiveKit AudioFrame
                    frame = rtc.AudioFrame(
                        audio_segment.raw_data,
                        audio_segment.frame_rate,
                        audio_segment.channels,
                        int(len(audio_segment.raw_data) / (audio_segment.channels * audio_segment.sample_width)),
                    )

                    # Put the frame into the queue. This is thread-safe.
                    asyncio.run_coroutine_threadsafe(
                        self._audio_queue.put(frame), self._loop
                    )
                except pydub.exceptions.CouldntDecodeError:
                    print("Could not decode audio chunk, skipping...")
                except Exception as e:
                    print(f"Error processing audio chunk in blocking thread: {e}")
        
        print("Blocking TTS pipeline loop finished.")                                                                                                                     

async def _run_agent(job: JobContext):
    print("Job received, creating agent...")
    agent = TTSSpeakerAgent(job)

    print("Connecting to the room...")
    try:
        # --- THIS IS THE MISSING STEP ---
        # This tells the worker to establish the connection to the room.
        await job.connect()
        print("Successfully connected to the room.")
    except Exception as e:
        print(f"Failed to connect to the room: {e}")
        return  # Exit if connection fails

    # Now that we're connected, agent.start() will run.
    # It will await the _connected_event, which was set
    # by the callback during the job.connect() process.
    try:
        await agent.start()
    except Exception as e:
        print(f"Unhandled error in agent.start(): {e}")
    finally:
        # Ensure cleanup runs even if start() fails
        print("Job finished, running cleanup...")
        await agent.cleanup()                                                                                                                               

def main():
    # This is the entry point for the LiveKit Agent Worker
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=_run_agent,
        ),
    )
if __name__ == "__main__":                                                                                                                                  
    main()