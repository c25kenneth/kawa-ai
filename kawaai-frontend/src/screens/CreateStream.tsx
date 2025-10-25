import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseConfig";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5000";

export default function CreateStream() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [game, setGame] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateStream = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("You must be logged in.");
        setLoading(false);
        return;
      }

      const user = session.user;
      const streamerName = user.user_metadata?.username || user.email;

      const response = await fetch(`${BACKEND_URL}/api/rooms/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title,
          game,
          streamerName,
          userId: user.id
        })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Failed to create stream");

      // Redirect to the livestream page
      navigate(`/stream/${result.roomId}`);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-16 bg-white shadow-lg rounded-2xl p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Create a New Stream</h1>
      <form onSubmit={handleCreateStream} className="space-y-4">
        <div>
          <label className="block font-medium mb-1">Stream Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Late Night Coding Session"
            className="w-full border rounded-xl p-3 focus:ring focus:ring-indigo-200"
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Game / Topic</label>
          <input
            type="text"
            value={game}
            onChange={(e) => setGame(e.target.value)}
            placeholder="e.g., League of Legends"
            className="w-full border rounded-xl p-3 focus:ring focus:ring-indigo-200"
            required
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition"
        >
          {loading ? "Creating..." : "Start Stream"}
        </button>
      </form>
    </div>
  );
}
