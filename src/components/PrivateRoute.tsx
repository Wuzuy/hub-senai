import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Redireciona usuários não autenticados para a tela de login
export function PrivateRoute({ children }: { children: JSX.Element }) {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
}