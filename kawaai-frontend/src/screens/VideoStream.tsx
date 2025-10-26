/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  useDataChannel, 
  useLocalParticipant, 
  useRoomContext 
} from '@livekit/components-react';
import { MessageSquare, Send, Users, Loader2, ArrowLeft, StopCircle } from 'lucide-react';
import { supabase } from '../../supabaseConfig';
import { useParams, useNavigate } from 'react-router-dom';
import Live2DCharacter from '../components/Live2DCharacter';

const BACKEND_URL = 'http://127.0.0.1:5000';

interface User {
  id: string;
  email: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
  room_id: string;
}

interface Room {
  id: string;
  title: string;
  game: string;
  streamer_name: string;
  streamer_id: string;
  is_live: boolean;
  viewer_count: number;
  youtube_video_id?: string;
  live2d_model?: {
    modelDir: string;
    modelFileName: string;
  };
}

// YouTube Player Component
function YouTubePlayer({ videoId }: { videoId: string }) {
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load YouTube IFrame API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    // Initialize player when API is ready
    (window as any).onYouTubeIframeAPIReady = () => {
      new (window as any).YT.Player(playerRef.current, {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: (event: any) => {
            event.target.playVideo();
          },
        },
      });
    };
  }, [videoId]);

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={playerRef} className="w-full h-full" />
    </div>
  );
}

// Chat Panel Component (Now an overlay)
function ChatPanel({ roomId, roomInfo, isStreamer }: { roomId: string; roomInfo: Room | null; isStreamer: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const { localParticipant } = useLocalParticipant();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const room = useRoomContext();
  const navigate = useNavigate();

  const { message } = useDataChannel('chat');

  useEffect(() => {
    loadPreviousMessages();
  }, [roomId]);

  const loadPreviousMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data) {
        const formattedMessages: ChatMessage[] = data.map((msg: any) => ({
          id: msg.id,
          sender: msg.sender,
          message: msg.message,
          timestamp: new Date(msg.created_at).getTime(),
          room_id: msg.room_id
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Failed to load previous messages:', error);
    }
  };

  useEffect(() => {
    if (message && message.payload) {
      try {
        const decoded = new TextDecoder().decode(message.payload);
        const chatMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          sender: message.from?.identity || 'Unknown',
          message: decoded,
          timestamp: Date.now(),
          room_id: roomId,
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

  localParticipant.publishData(data, {
    reliable: true,
    topic: 'chat',
  });

  // Get the current authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error('User not authenticated');
    return;
  }

  const chatMessage: ChatMessage = {
    id: crypto.randomUUID(),
    sender: user.id, // ✅ Use actual user ID
    message: messageText,
    timestamp: Date.now(),
    room_id: roomId,
  };

  setMessages((prev) => [...prev, chatMessage]);
  setInput('');

  try {
    const { error } = await supabase
      .from('messages')
      .insert([
        {
          sender: user.id, // ✅ Use actual user ID that exists in auth.users
          message: chatMessage.message,
          room_id: roomId,
          created_at: new Date(chatMessage.timestamp).toISOString(),
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

  const endStream = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      await fetch(`${BACKEND_URL}/api/rooms/${roomId}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      navigate('/');
    } catch (error) {
      console.error('Failed to end stream:', error);
    }
  };

  const participantCount = room.remoteParticipants.size + 1;

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Main Content Area with YouTube Video */}
      <div className="flex-1 relative">
        {/* YouTube Video Background */}
        {roomInfo?.youtube_video_id && (
          <YouTubePlayer videoId={roomInfo.youtube_video_id} />
        )}
        
        {/* No Video Placeholder */}
        {!roomInfo?.youtube_video_id && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">No video playing</p>
            </div>
          </div>
        )}

        {/* Live2D Character Overlay - Left Side */}
        {roomInfo?.live2d_model && (
          <div className="absolute bottom-0 left-8 w-[450px] h-[550px] pointer-events-auto z-20 overflow-visible">
            <Live2DCharacter
              modelDir={roomInfo.live2d_model.modelDir}
              modelFileName={roomInfo.live2d_model.modelFileName}
              width="100%"
              height="100%"
            />
          </div>
        )}

        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-white">
                  {roomInfo?.title || 'Stream'}
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <span>{roomInfo?.streamer_name}</span>
                  <span>•</span>
                  <span>{roomInfo?.game}</span>
                </div>
              </div>
            </div>
            
            {isStreamer && (
              <button
                onClick={endStream}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
              >
                <StopCircle className="w-4 h-4" />
                <span className="text-sm font-medium">End Stream</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Overlay Panel */}
      <div className="w-96 flex flex-col bg-gray-900/95 backdrop-blur-sm border-l border-gray-700">
        {/* Chat Header */}
        <div className="bg-gray-800/90 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <h2 className="font-semibold text-white">Live Chat</h2>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-400">
              <Users className="w-4 h-4" />
              <span>{participantCount}</span>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-blue-400 text-sm">
                    {msg.sender}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-gray-200 text-sm break-words">{msg.message}</p>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-700 p-4 bg-gray-800/90">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Send a message..."
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed p-2 rounded-lg transition-colors"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function TextOnlyLivestream() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [wsUrl, setWsUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [roomInfo, setRoomInfo] = useState<Room | null>(null);
  const [isStreamer, setIsStreamer] = useState(false);

  useEffect(() => {
    checkAuth();
    if (roomId) {
      loadRoomInfo();
    }
  }, [roomId]);

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

  const loadRoomInfo = async () => {
    if (!roomId) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/rooms/${roomId}`);
      
      if (!response.ok) {
        throw new Error('Room not found');
      }

      const data = await response.json();
      setRoomInfo(data.room);
    } catch (err) {
      console.error('Failed to load room:', err);
      setError('Room not found');
    }
  };

  const joinRoom = async () => {
    if (!user || !roomId) {
      setError('Invalid request');
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
          roomName: roomId,
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
      setIsStreamer(roomInfo?.streamer_id === user.id);
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
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

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

  if (!roomInfo && !loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Room Not Found
          </h1>
          <p className="text-gray-400 mb-6">
            This stream may have ended or doesn't exist
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

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
        <ChatPanel roomId={roomId!} roomInfo={roomInfo} isStreamer={isStreamer} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <MessageSquare className="w-12 h-12 text-blue-500" />
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-2">
          {roomInfo?.title}
        </h1>
        
        <p className="text-gray-400 text-center mb-6">
          Hosted by {roomInfo?.streamer_name}
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
              Join Stream
            </>
          )}
        </button>

        <div className="mt-6 p-4 bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-300">
            <strong>Category:</strong> {roomInfo?.game}
          </p>
          {roomInfo?.youtube_video_id && (
            <p className="text-sm text-gray-300 mt-1">
              <strong>Video:</strong> YouTube stream
            </p>
          )}
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full mt-4 px-4 py-2 text-gray-400 hover:text-white transition"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}