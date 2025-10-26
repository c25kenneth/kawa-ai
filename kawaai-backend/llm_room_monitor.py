"""
Simplified LLM Room Monitor
Stays connected to rooms and handles chat messages for TTS.
"""

import asyncio
import json
import re
import httpx
from livekit import api, rtc
import os
from dotenv import load_dotenv

load_dotenv()

# Environment variables
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
JANITOR_API_KEY = os.getenv("JANITOR_API_KEY")

# Global room connections
room_connections = {}

def strip_markdown(text: str) -> str:
    """Strip markdown formatting for TTS."""
    if not text:
        return text
    
    # Remove common markdown patterns
    text = re.sub(r'\*\*([^\*]+)\*\*', r'\1', text)  # Bold
    text = re.sub(r'\*([^\*]+)\*', r'\1', text)      # Italic
    text = re.sub(r'`([^`]+)`', r'\1', text)         # Inline code
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)  # Links
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)  # Headers
    text = re.sub(r'^[\*\-\+]\s+', '', text, flags=re.MULTILINE)  # Lists
    text = re.sub(r'<[^>]+>', '', text)  # HTML tags
    text = re.sub(r'\s+', ' ', text)  # Multiple spaces
    return text.strip()


class RoomMonitor:
    """Manages a persistent LLM sender connection to a specific room."""
    
    def __init__(self, room_name: str):
        self.room_name = room_name
        self.room = None
        self.connected = False
        self.persona = ""
        self.backstory = ""
        
    async def connect(self, persona: str = "", backstory: str = ""):
        """Connect to the room as an LLM sender participant."""
        if self.connected:
            print(f"✓ Already connected to room {self.room_name}")
            return
            
        self.persona = persona
        self.backstory = backstory
        
        try:
            # Create unique identity
            llm_sender_identity = f"llm-sender-{self.room_name}"
            
            # Create token
            token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            token.with_identity(llm_sender_identity)
            token.with_name(f"LLM Monitor ({self.room_name[:8]})")
            token.with_grants(api.VideoGrants(
                room_join=True,
                room=self.room_name,
                can_publish_data=True,
                can_subscribe=True,
            ))
            
            # Connect to room
            self.room = rtc.Room()
            self.room.on("data_received", self._on_message_received)
            self.room.on("participant_connected", self._on_participant_connected)
            self.room.on("participant_disconnected", self._on_participant_disconnected)
            
            await self.room.connect(LIVEKIT_URL, token.to_jwt())
            
            self.connected = True
            print(f"✅ Connected to room {self.room_name} as LLM sender")
            
            # Start monitoring loop
            asyncio.create_task(self._room_monitor_loop())
            
        except Exception as e:
            print(f"❌ Failed to connect to room {self.room_name}: {e}")
            import traceback
            traceback.print_exc()
            
    def _on_participant_connected(self, participant: rtc.RemoteParticipant):
        print(f"👤 Participant joined {self.room_name}: {participant.identity}")
        
    def _on_participant_disconnected(self, participant: rtc.RemoteParticipant):
        print(f"👤 Participant left {self.room_name}: {participant.identity}")
        
    def _on_message_received(self, data: rtc.DataPacket):
        """Handle incoming chat messages from room participants."""
        async def _process():
            try:
                text = data.data.decode("utf-8")
                
                # Only process chat messages (ignore our own messages)
                if data.participant and data.participant.identity.startswith("llm-sender"):
                    return  # Ignore our own messages
                    
                # Try to parse as JSON
                try:
                    msg_data = json.loads(text)
                    
                    # Check if this is a chat message we should respond to
                    if "type" in msg_data and msg_data["type"] == "chat":
                        user_text = msg_data.get("text", "")
                        if user_text.strip():
                            print(f"💬 Received chat message in {self.room_name}: {user_text[:50]}")
                            await self._process_chat_message(user_text)
                            
                except json.JSONDecodeError:
                    # Not JSON, might be plain text - could handle if needed
                    pass
                    
            except Exception as e:
                print(f"❌ Error processing message: {e}")
        
        asyncio.create_task(_process())
        
    async def _process_chat_message(self, user_text: str):
        """Send user message to LLM, get response, and send to TTS agent."""
        try:
            # Check if still connected
            if not self.connected or not self.room:
                print(f"⚠️ Room {self.room_name} is not connected, skipping chat message")
                return
                
            # Build system prompt
            system_prompt = "You are a helpful AI assistant. Keep responses concise and conversational (2-3 sentences max)."
            if self.persona:
                system_prompt = f"{self.persona} Keep responses short and natural (2-3 sentences max)."
            if self.backstory:
                system_prompt += f" Background: {self.backstory}"
            
            # Call LLM
            url = "https://janitorai.com/hackathon/completions"
            headers = {
                "Authorization": JANITOR_API_KEY,
                "Content-Type": "application/json",
            }
            llm_data = {
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_text}
                ],
                "stream": True,
                "max_tokens": 150
            }
            
            async with httpx.AsyncClient() as client:
                async with client.stream("POST", url, headers=headers, json=llm_data, timeout=None) as response:
                    response.raise_for_status()
                    
                    buffer = ""
                    full_response = ""
                    
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
                                        full_response += delta_content
                                        
                                        # Strip markdown for TTS
                                        cleaned_text = strip_markdown(delta_content)
                                        
                                        if cleaned_text.strip():
                                            # Send to TTS agent in room
                                            chat_data = {
                                                "type": "chat",
                                                "text": cleaned_text
                                            }
                                            
                                            await self.room.local_participant.publish_data(
                                                json.dumps(chat_data).encode('utf-8'),
                                                reliable=True
                                            )
                                            
                                except json.JSONDecodeError:
                                    pass
                    
                    # Send flush signal
                    await self.room.local_participant.publish_data(
                        json.dumps({"type": "flush"}).encode('utf-8'),
                        reliable=True
                    )
                    
                    print(f"✅ Sent LLM response to room {self.room_name}")
                    
        except httpx.HTTPStatusError as e:
            print(f"❌ LLM API error: {e}")
            print(f"Response: {e.response.text if e.response else 'No response'}")
        except Exception as e:
            print(f"❌ Error processing chat message: {e}")
            import traceback
            traceback.print_exc()
            # Don't disconnect on error - just log it and continue
            
    async def _room_monitor_loop(self):
        """Monitor room state and handle disconnections."""
        while True:
            try:
                await asyncio.sleep(10)
                
                # Check if room is still connected
                if not self.connected or not self.room:
                    print(f"⚠️ Room {self.room_name} disconnected, attempting reconnect...")
                    try:
                        await self.connect(self.persona, self.backstory)
                        print(f"✅ Reconnected to room {self.room_name}")
                    except Exception as reconnect_error:
                        print(f"❌ Failed to reconnect: {reconnect_error}")
                        await asyncio.sleep(5)  # Wait before retry
                        
            except asyncio.CancelledError:
                print(f"🛑 Room monitor loop cancelled for {self.room_name}")
                break
            except Exception as e:
                print(f"❌ Error in room monitor loop: {e}")
                import traceback
                traceback.print_exc()
                # Keep the loop running even on error
                await asyncio.sleep(5)
            
    async def disconnect(self):
        """Disconnect from the room."""
        self.connected = False
        try:
            if self.room:
                if self.room.isconnected:
                    await self.room.disconnect()
                self.room = None
        except Exception as e:
            print(f"⚠️ Error during disconnect: {e}")
        print(f"🔌 Disconnected from room {self.room_name}")


async def connect_to_room(room_name: str, persona: str = "", backstory: str = ""):
    """Connect to a room (or return existing connection)."""
    if room_name in room_connections:
        monitor = room_connections[room_name]
        if monitor.connected:
            print(f"✓ Already connected to room {room_name}")
            return monitor
        
    # Create new connection
    monitor = RoomMonitor(room_name)
    await monitor.connect(persona, backstory)
    room_connections[room_name] = monitor
    return monitor


async def disconnect_from_room(room_name: str):
    """Disconnect from a room."""
    if room_name in room_connections:
        monitor = room_connections[room_name]
        await monitor.disconnect()
        del room_connections[room_name]


if __name__ == "__main__":
    # Test mode
    async def test():
        print("Testing LLM Room Monitor...")
        monitor = RoomMonitor("test-room")
        await monitor.connect()
        
        # Keep running
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            await monitor.disconnect()
            
    asyncio.run(test())
