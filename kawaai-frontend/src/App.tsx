import AuthPage from "./screens/Authenticate"
import './index.css';
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute"
import HomePage from "./screens/HomePage";
import LiveStreamViewer from "./screens/VideoStream";
import CreateStream from "./screens/CreateStream";
import TextOnlyLivestream from "./screens/VideoStream";
// import StartStreamPage from './screens/StartStream';

function App() {

  return (
      <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route 
          path="/home" 
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/start-stream" 
          element={
            <ProtectedRoute>
              <CreateStream />
            </ProtectedRoute>
          } 
        />
        <Route path="/stream/:roomId" element={<TextOnlyLivestream />} />
        <Route 
          path="/video-stream" 
          element={
            <ProtectedRoute>
              <LiveStreamViewer />
            </ProtectedRoute>
          } 
        />
        <Route path="/" element={<Navigate to="/auth" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
