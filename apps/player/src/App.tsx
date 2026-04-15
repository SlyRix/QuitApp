import { Routes, Route, Navigate } from "react-router-dom";
import JoinGame from "./pages/JoinGame";
import GamePlay from "./pages/GamePlay";

export default function App() {
  return (
    <Routes>
      <Route path="/join" element={<JoinGame />} />
      <Route path="/join/:pin" element={<JoinGame />} />
      <Route path="/game" element={<GamePlay />} />
      <Route path="*" element={<Navigate to="/join" replace />} />
    </Routes>
  );
}
