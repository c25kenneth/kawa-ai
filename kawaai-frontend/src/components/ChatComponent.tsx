import { useChat } from "@livekit/components-react";

export default function ChatComponent() {
  const { chatMessages, send, isSending } = useChat();

  return (
    <div>
      {chatMessages.map((msg) => (
        <div key={msg.timestamp}>
          {msg.from?.identity}: {msg.message}
        </div>
      ))}
      <button disabled={isSending} onClick={() => send("Hello!")}>
        Send Message
      </button>
    </div>
  );
}