import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db, auth } from "../config/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, or, and, deleteDoc, limit, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { colors } from "../styles/colors";
import { Button } from "../components/common/Button";

export function Hub() {
  const { currentUser } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [userData, setUserData] = useState<any>(null);
  const [activeMatch, setActiveMatch] = useState<{ id: string; status: string } | null>(null);
  const [joinId, setJoinId] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [availableMatches, setAvailableMatches] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchUser() {
      if (currentUser) {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setUserData(docSnap.data());
      }
    }
    fetchUser();
  }, [currentUser]);

  // Monitora partidas atias (waiting ou playing) do usuário atual
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "chess_matches"),
      and(
        or(
          where("playerWhite", "==", currentUser.uid),
          where("playerBlack", "==", currentUser.uid)
        ),
        where("status", "in", ["waiting", "playing"])
      )
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setActiveMatch({ id: doc.id, status: doc.data().status });
      } else {
        setActiveMatch(null);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    const q = query(collection(db, "chess_matches"), where("status", "==", "waiting"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matches = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAvailableMatches(matches);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // Cria um novo documento de partida com status waiting
  const createNewMatch = async () => {
    if (!currentUser || activeMatch) return null;
    const matchId = Math.floor(100000 + Math.random() * 900000).toString();
    await setDoc(doc(db, "chess_matches", matchId), {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      playerWhite: currentUser.uid,
      playerBlack: null,
      status: "waiting",
      whiteTime: 600,
      blackTime: 600,
      createdAt: Date.now()
    });
    return matchId;
  };

  // Deleta a partida se o usuário cancelar a busca
  const handleCancelMatch = async () => {
    if (activeMatch?.id && activeMatch.status === "waiting") {
      await deleteDoc(doc(db, "chess_matches", activeMatch.id));
    }
  };

  const handleRandomMatch = async () => {
    if (!currentUser || activeMatch) return;
    
    const q = query(collection(db, "chess_matches"), where("status", "==", "waiting"), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const matchDoc = snapshot.docs[0];
      if (matchDoc.data().playerWhite !== currentUser.uid) {
        await updateDoc(doc(db, "chess_matches", matchDoc.id), {
          playerBlack: currentUser.uid,
          status: "playing"
        });
        navigate(`/chess/${matchDoc.id}`);
        return;
      }
    }
    const newId = await createNewMatch();
    if (newId) navigate(`/chess/${newId}`);
  };

  const handleJoinMatch = async (id: string) => {
    if (!currentUser || activeMatch) return;
    await updateDoc(doc(db, "chess_matches", id), {
      playerBlack: currentUser.uid,
      status: "playing"
    });
    navigate(`/chess/${id}`);
  };

  return (
    <div style={{ height: "100vh", overflow: "hidden", boxSizing: "border-box", backgroundColor: colors.dark.bg, color: colors.dark.text, padding: "20px", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${colors.dark.border}`, paddingBottom: "15px", marginBottom: "30px" }}>
        <h1>Hub de Jogos</h1>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          {userData && (
            <span style={{ color: colors.dark.textSecondary }}>
              {userData.username} (Elo: {userData.stats?.chess?.elo})
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={handleLogout}>Sair</Button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
        
        <section style={{ display: "flex", flexDirection: "column", gap: "20px", backgroundColor: colors.dark.bgSecondary, padding: "30px", borderRadius: "12px" }}>
          <h2>Jogar Xadrez</h2>
          
          {activeMatch ? (
            <div style={{ textAlign: "center", padding: "20px", border: `2px solid ${activeMatch.status === 'playing' ? colors.primary : colors.warning}`, borderRadius: "8px" }}>
              <p style={{ marginBottom: "15px" }}>
                {activeMatch.status === "playing" ? "Você tem uma partida em andamento!" : "Buscando oponente..."}
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Button size="lg" fullWidth onClick={() => navigate(`/chess/${activeMatch.id}`)}>
                  {activeMatch.status === "playing" ? "Reentrar na Partida" : "Ver Tabuleiro"}
                </Button>
                
                {activeMatch.status === "waiting" && (
                  <Button variant="danger" onClick={handleCancelMatch}>
                    Cancelar Busca
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <Button size="lg" onClick={handleRandomMatch}>Jogar Partida Aleatória</Button>
              <Button variant="secondary" size="lg" onClick={() => createNewMatch().then(id => id && navigate(`/chess/${id}`))}>
                Criar Nova Partida
              </Button>
              
              <form onSubmit={(e) => { e.preventDefault(); handleJoinMatch(joinId); }} style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <input 
                  type="text" 
                  placeholder="ID da partida..." 
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  style={{ flex: 1, padding: "10px", borderRadius: "6px", border: `1px solid ${colors.dark.border}`, backgroundColor: colors.dark.bgTertiary, color: colors.dark.text }}
                />
                <Button type="submit">Entrar</Button>
              </form>
            </>
          )}
        </section>

        <section style={{ backgroundColor: colors.dark.bgSecondary, padding: "30px", borderRadius: "12px", overflowY: "auto", maxHeight: "calc(100vh - 150px)" }}>
          <h2>Lobby Aberto</h2>
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px", marginTop: "15px" }}>
            {availableMatches.length === 0 && <li style={{ color: colors.dark.textSecondary }}>Nenhuma partida aberta.</li>}
            {availableMatches.map((m) => (
              <li key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", backgroundColor: colors.dark.bgTertiary, borderRadius: "6px" }}>
                <span>ID: {m.id}</span>
                {!activeMatch && m.playerWhite !== currentUser?.uid && (
                  <Button size="sm" onClick={() => handleJoinMatch(m.id)}>Jogar</Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}