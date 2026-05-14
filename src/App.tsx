import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PrivateRoute } from "./components/PrivateRoute";
import { Login } from "./pages/Login";
import { Hub } from "./pages/Hub";
import { ChessGame } from "./pages/ChessGame";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <PrivateRoute>
                <Hub />
              </PrivateRoute>
            }
          />

          <Route
            path="/chess"
            element={
              <PrivateRoute>
                <ChessGame />
              </PrivateRoute>
            }
          />

          <Route
            path="/chess/:matchId"
            element={
              <PrivateRoute>
                <ChessGame />
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}