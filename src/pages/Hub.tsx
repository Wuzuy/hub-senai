import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db, auth } from "../config/firebase";
// Importações atualizadas para busca e atualização
import { doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export function Hub() {
  const { currentUser } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [userData, setUserData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [availableMatches, setAvailableMatches] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchUser() {
      if (currentUser) {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      }
    }
    fetchUser();
  }, [currentUser]);

  // Lista partidas aguardando segundo jogador
  useEffect(() => {
    const q = query(collection(db, "chess_matches"), where("status", "==", "waiting"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailableMatches(matches);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const handleCreateMatch = async () => {
    if (!currentUser) return;
    const matchId = crypto.randomUUID();
    
    await setDoc(doc(db, "chess_matches", matchId), {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      playerWhite: currentUser.uid,
      playerBlack: null,
      status: "waiting"
    });

    navigate(`/chess/${matchId}`);
  };

  // Define o usuário atual como playerBlack e inicia a partida
  const handleJoinMatch = async (matchId: string) => {
    if (!currentUser) return;
    
    await updateDoc(doc(db, "chess_matches", matchId), {
      playerBlack: currentUser.uid,
      status: "playing"
    });

    navigate(`/chess/${matchId}`);
  };

  return (
    <div>
      <h1>Hub Central</h1>
      {userData ? (
        <div>
          <p>Jogador: {userData.username}</p>
          <p>Rating Xadrez: {userData.stats?.chess?.elo}</p>
        </div>
      ) : (
        <p>Carregando dados...</p>
      )}
      
      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <h2>Lobby</h2>
        <button onClick={handleCreateMatch}>Criar Nova Partida</button>

        <h3>Partidas Abertas:</h3>
        <ul>
          {availableMatches.map((match) => (
            <li key={match.id}>
              Partida de: {match.playerWhite}{" "}
              {match.playerWhite !== currentUser?.uid && (
                <button onClick={() => handleJoinMatch(match.id)}>Entrar</button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <button onClick={handleLogout}>Desconectar</button>
    </div>
  );
}