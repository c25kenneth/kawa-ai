/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Search, Menu, User, Eye, Radio, PlusCircle, Play } from "lucide-react";
import { signOut } from "../hooks/AuthFunctions";
import { useNavigate } from "react-router-dom";

interface Room {
  id: string;
  title: string;
  game: string;
  streamer_name: string;
  viewer_count: number;
  is_live: boolean;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5000";

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState("For You");
  const [searchQuery, setSearchQuery] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [pastRooms, setPastRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const categories = ["For You", "Following", "Games", "IRL", "Music", "Esports"];

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const [liveRes, pastRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/rooms/list`),
          fetch(`${BACKEND_URL}/api/rooms/past`),
        ]);

        const liveData = await liveRes.json();
        const pastData = await pastRes.json();

        if (!liveRes.ok) throw new Error(liveData.error || "Failed to fetch live streams");
        if (!pastRes.ok) throw new Error(pastData.error || "Failed to fetch past streams");

        setRooms(liveData.rooms || []);
        setPastRooms(pastData.rooms || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* NAVBAR */}
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Menu className="w-6 h-6 cursor-pointer hover:text-indigo-400 transition" />
            <div className="hidden md:flex items-center space-x-6">
              {categories.slice(0, 3).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-sm font-medium transition ${
                    activeCategory === cat
                      ? "text-indigo-400"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* CREATE STREAM */}
            <PlusCircle
              className="w-12 h-12 cursor-pointer hover:text-indigo-400 transition"
              onClick={() => navigate("/start-stream")}
            />

            {/* USER ICON */}
            <div
              className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition"
              onClick={signOut}
            >
              <User className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* CATEGORY PILLS */}
        <div className="px-4 py-3 flex items-center space-x-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                activeCategory === cat
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="px-4 py-6 space-y-10">
        {/* LIVE STREAMS */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Live Streams</h2>
            <p className="text-gray-400">Watch live channels now</p>
          </div>

          {loading && <p>Loading streams...</p>}
          {error && <p className="text-red-500">{error}</p>}

          {!loading && rooms.length === 0 && (
            <p className="text-gray-400">No live streams yet. Be the first to go live!</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="group cursor-pointer"
                onClick={() => navigate(`/stream/${room.id}`)}
              >
                <div className="relative aspect-video rounded-lg overflow-hidden mb-2 bg-gray-800">
                  <div className="w-full h-full flex items-center justify-center text-6xl">
                    🎥
                  </div>

                  {room.is_live && (
                    <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold flex items-center space-x-1">
                      <Radio className="w-3 h-3" />
                      <span>LIVE</span>
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-0.5 rounded text-xs flex items-center space-x-1">
                    <Eye className="w-3 h-3" />
                    <span>{room.viewer_count}</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0 text-lg">
                    🎮
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate group-hover:text-indigo-400 transition">
                      {room.title}
                    </h3>
                    <p className="text-gray-400 text-sm">{room.streamer_name}</p>
                    <p className="text-gray-500 text-xs">{room.game}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PAST STREAMS */}
        {pastRooms.length > 0 && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Past Streams</h2>
              <p className="text-gray-400">Catch up on recent replays</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {pastRooms.map((room) => (
                <div
                  key={room.id}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/replay/${room.id}`)}
                >
                  <div className="relative aspect-video rounded-lg overflow-hidden mb-2 bg-gray-800">
                    <div className="w-full h-full flex items-center justify-center text-6xl">
                      🎞️
                    </div>

                    <div className="absolute top-2 left-2 bg-indigo-600 text-white px-2 py-0.5 rounded text-xs font-bold flex items-center space-x-1">
                      <Play className="w-3 h-3" />
                      <span>REPLAY</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0 text-lg">
                      🎮
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate group-hover:text-indigo-400 transition">
                        {room.title}
                      </h3>
                      <p className="text-gray-400 text-sm">{room.streamer_name}</p>
                      <p className="text-gray-500 text-xs">{room.game}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
