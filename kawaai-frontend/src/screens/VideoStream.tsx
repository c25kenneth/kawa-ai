import { LiveKitRoom, VideoConference, Chat } from '@livekit/components-react';

const TOKEN = 'generated-jwt';
const WS_URL = 'wss://my-livekit-server';

export default function VideoStream() {
  return (
    <LiveKitRoom token={TOKEN} serverUrl={WS_URL} connect={true}>
      <VideoConference />
      <Chat />
    </LiveKitRoom>
  );
}