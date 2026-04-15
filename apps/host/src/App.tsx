import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import Dashboard from "./pages/Dashboard";
import QuizBuilder from "./pages/QuizBuilder";
import HostGame from "./pages/HostGame";
import Login from "./pages/Login";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quizzes/new"
        element={
          <ProtectedRoute>
            <QuizBuilder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quizzes/:id/edit"
        element={
          <ProtectedRoute>
            <QuizBuilder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/games/:pin/host"
        element={
          <ProtectedRoute>
            <HostGame />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
