// TextOnlyLivestream.tsx
// Complete text-only chat component for your React app

import React, { useState, useEffect, useRef } from 'react';
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  useDataChannel, 
  useLocalParticipant, 
  useRoomContext 
} from '@livekit/components-react';
import { MessageSquare, Send, Users, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseConfig'; // Your Supabase client

const BACKEND_URL = 'http://127.0.0.1:5000';
const DEFAULT_ROOM = 'main-room';

interface User {
  id: string;
  email: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
}

// Chat Panel Component - Only shows inside the LiveKit room
function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const { localParticipant } = useLocalParticipant();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const room = useRoomContext();

  // Listen for incoming chat messages
  const { message } = useDataChannel('chat');

  useEffect(() => {
    if (message && message.payload) {
      try {
        const decoded = new TextDecoder().decode(message.payload);
        const chatMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          sender: message.from?.identity || 'Unknown',
          message: decoded,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, chatMessage]);
      } catch (error) {
        console.error('Failed to decode message:', error);
      }
    }
  }, [message]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
  if (!input.trim() || !localParticipant) return;

  const messageText = input.trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(messageText);

  // Send to other participants
  localParticipant.publishData(data, {
    reliable: true,
    topic: 'chat',
  });

  // Create a chat message object
  const chatMessage: ChatMessage = {
    id: `${Date.now()}-${Math.random()}`,
    sender: localParticipant.identity,
    message: messageText,
    timestamp: Date.now(),
  };

  // Add to local chat state immediately
  setMessages((prev) => [...prev, chatMessage]);
  setInput('');

  // Upload message to Supabase
  try {
    const { error } = await supabase
      .from('messages')
      .insert([
        {
          id: chatMessage.id,
          sender: chatMessage.sender,
          message: chatMessage.message,
          created_at: chatMessage.timestamp,
        },
      ]);

    if (error) {
      console.error('Error uploading message to Supabase:', error.message);
    }
  } catch (err) {
    console.error('Unexpected error uploading message:', err);
  }
};


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const participantCount = room.remoteParticipants.size + 1;

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-blue-500" />
            <div>
              <h1 className="text-lg font-semibold text-white">{DEFAULT_ROOM}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Users className="w-4 h-4" />
                <span>{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-blue-400">
                    {msg.sender}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-gray-200 break-words">{msg.message}</p>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-700 p-4 bg-gray-800">
        <div className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
          >
            <Send className="w-5 h-5 text-white" />
            <span className="text-white font-medium">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function TextOnlyLivestream() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [wsUrl, setWsUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || 'User'
        });
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!user) {
      setError('Please sign in first');
      return;
    }

    setJoining(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${BACKEND_URL}/api/livekit-token/authenticated`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          roomName: DEFAULT_ROOM,
          participantName: user.email.split('@')[0],
          participantId: user.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join room');
      }

      const data = await response.json();
      setToken(data.token);
      setWsUrl(data.wsUrl);
      setIsInRoom(true);
    } catch (err) {
      console.error('Failed to join room:', err);
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setJoining(false);
    }
  };

  const leaveRoom = () => {
    setToken('');
    setWsUrl('');
    setIsInRoom(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Please Sign In
          </h1>
          <p className="text-gray-400 mb-6">
            You need to be signed in to join the chat
          </p>
        </div>
      </div>
    );
  }

  // In room - Show chat interface
  if (isInRoom && token && wsUrl) {
    return (
      <LiveKitRoom
        video={false}
        audio={false}
        token={token}
        serverUrl={wsUrl}
        connect={true}
        onDisconnected={leaveRoom}
      >
        <ChatPanel />
        <RoomAudioRenderer />
      </LiveKitRoom>
    );
  }

  // Ready to join - Show join screen
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <MessageSquare className="w-12 h-12 text-blue-500" />
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-2">
          Welcome, {user.email.split('@')[0]}!
        </h1>
        
        <p className="text-gray-400 text-center mb-6">
          Join the conversation with text messages only
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={joinRoom}
          disabled={joining}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {joining ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Joining...
            </>
          ) : (
            <>
              <MessageSquare className="w-5 h-5" />
              Join Chat Room
            </>
          )}
        </button>

        <div className="mt-6 p-4 bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-300">
            <strong>Room:</strong> {DEFAULT_ROOM}
          </p>
          <p className="text-sm text-gray-300 mt-1">
            <strong>Mode:</strong> Text-only chat
          </p>
        </div>
      </div>
    </div>
  );
}