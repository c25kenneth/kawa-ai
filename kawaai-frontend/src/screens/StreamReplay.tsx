/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Users, ArrowLeft, Calendar, Clock } from 'lucide-react';
import { supabase } from '../../supabaseConfig';
import { useParams, useNavigate } from 'react-router-dom';

const BACKEND_URL = 'http://127.0.0.1:5000';

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
  room_id: string;
  created_at: string;
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
  created_at: string;
  ended_at?: string;
}

// YouTube Player Component for Replay
function YouTubeReplayPlayer({ videoId }: { videoId: string }) {
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
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
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

// Chat History Panel
function ChatHistoryPanel({ roomId, roomInfo }: { roomId: string; roomInfo: Room | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChatHistory();
  }, [roomId]);

  const loadChatHistory = async () => {
    try {
      console.log('Loading chat history for room:', roomId);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      console.log('Chat query result:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (data) {
        console.log(`Found ${data.length} messages`);
        const formattedMessages: ChatMessage[] = data.map((msg: any) => ({
          id: msg.id || crypto.randomUUID(),
          sender: msg.sender || msg.username || 'Anonymous',
          message: msg.message || msg.content || '',
          timestamp: msg.timestamp || new Date(msg.created_at).getTime(),
          room_id: msg.room_id,
          created_at: msg.created_at
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatStreamDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatStreamTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const calculateDuration = (start: string, end?: string) => {
    if (!end) return 'N/A';
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const durationMs = endTime - startTime;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Main Content Area with YouTube Video */}
      <div className="flex-1 relative">
        {/* YouTube Video Background */}
        {roomInfo?.youtube_video_id ? (
          <YouTubeReplayPlayer videoId={roomInfo.youtube_video_id} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">No video available</p>
            </div>
          </div>
        )}

        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.history.back()}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-white">
                  {roomInfo?.title || 'Stream Replay'}
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <span>{roomInfo?.streamer_name}</span>
                  <span>•</span>
                  <span>{roomInfo?.game}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-600 rounded text-xs font-medium">
                    REPLAY
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stream Info Bar */}
          {roomInfo && (
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-300">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{formatStreamDate(roomInfo.created_at)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{formatStreamTime(roomInfo.created_at)}</span>
              </div>
              {roomInfo.ended_at && (
                <div className="flex items-center gap-1">
                  <span>Duration: {calculateDuration(roomInfo.created_at, roomInfo.ended_at)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat History Panel */}
      <div className="w-96 flex flex-col bg-gray-900/95 backdrop-blur-sm border-l border-gray-700">
        {/* Chat Header */}
        <div className="bg-gray-800/90 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-500" />
              <h2 className="font-semibold text-white">Chat History</h2>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-400">
              <Users className="w-4 h-4" />
              <span>{messages.length}</span>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center text-gray-500 mt-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50 animate-pulse" />
              <p className="text-sm">Loading chat history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages in this stream</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-purple-400 text-sm">
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

        {/* Info Footer */}
        <div className="border-t border-gray-700 p-4 bg-gray-800/90">
          <p className="text-xs text-gray-400 text-center">
            This is a replay. Chat is read-only.
          </p>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function StreamReplay() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roomInfo, setRoomInfo] = useState<Room | null>(null);

  useEffect(() => {
    if (roomId) {
      loadRoomInfo();
    }
  }, [roomId]);

  const loadRoomInfo = async () => {
    if (!roomId) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/rooms/${roomId}`);
      
      if (!response.ok) {
        throw new Error('Room not found');
      }

      const data = await response.json();
      
      // Check if room is actually ended
      if (data.room.is_live) {
        setError('This stream is currently live');
        return;
      }
      
      setRoomInfo(data.room);
    } catch (err) {
      console.error('Failed to load room:', err);
      setError('Stream not found');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 text-purple-500 animate-pulse mx-auto mb-4" />
          <p className="text-white">Loading replay...</p>
        </div>
      </div>
    );
  }

  if (error || !roomInfo) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            {error || 'Replay Not Found'}
          </h1>
          <p className="text-gray-400 mb-6">
            This stream may have been deleted or doesn't exist
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

  return <ChatHistoryPanel roomId={roomId!} roomInfo={roomInfo} />;
}