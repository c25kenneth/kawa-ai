import AuthPage from "./screens/Authenticate"
import './index.css';
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute"
import HomePage from "./screens/HomePage";
import StartStreamPage from "./screens/StartStream";
import LiveStreamViewer from "./screens/VideoStream";
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
              <StartStreamPage />
            </ProtectedRoute>
          } 
        />
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
