import React, { useState, useEffect, useRef } from 'react'
import { useDataChannel, useLocalParticipant } from '@livekit/components-react'
// import { DataPacket_Kind } from 'livekit-client'

interface ChatMessage {
  sender: string
  message: string
  timestamp: number
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const { localParticipant } = useLocalParticipant()
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Listen for data messages
  const { message } = useDataChannel('chat')

  useEffect(() => {
    if (message) {
      const decoded = new TextDecoder().decode(message.payload)
      const chatMessage: ChatMessage = {
        sender: message.from?.identity || 'Unknown',
        message: decoded,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, chatMessage])
    }
  }, [message])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    if (!input.trim() || !localParticipant) return

    const encoder = new TextEncoder()
    const data = encoder.encode(input)

    localParticipant.publishData(data, {
      reliable: true,
      destinationIdentities: [], // Send to all
      topic: 'chat'
    })

    setInput('')
  }

  return (
    <div className="chat-panel">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className="message">
            <strong>{msg.sender}:</strong> {msg.message}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  )
}