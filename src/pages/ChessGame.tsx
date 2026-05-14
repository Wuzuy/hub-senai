import { useEffect, useState } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../styles/colors";
import { Button } from "../components/common/Button";

const pieceImages: Record<string, string> = {
  wK: "https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg",
  wQ: "https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg",
  wR: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
  wB: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg",
  wN: "https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg",
  wP: "https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg",

  bK: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
  bQ: "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg",
  bR: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg",
  bB: "https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg",
  bN: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg",
  bP: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const customPieces = Object.keys(pieceImages).reduce((acc: any, piece) => {
  acc[piece] = () => (
    <img
      src={pieceImages[piece]}
      alt={piece}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        display: "block",
        pointerEvents: "none",
      }}
    />
  );
  return acc;
}, {});

export function ChessGame() {
  const { matchId } = useParams();
  const { currentUser } = useAuth();
  const [game, setGame] = useState(new Chess());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [matchData, setMatchData] = useState<any>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, { background: string; borderRadius?: string }>>({});
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [previousFen, setPreviousFen] = useState<string | null>(null);
  
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const [whiteName, setWhiteName] = useState("Aguardando...");
  const [blackName, setBlackName] = useState("Aguardando...");

  const navigate = useNavigate();

  // Encontra o ultimo movimento comparando o FEN antigo e novo
  function findLastMoveFromFen(oldFen: string, newFen: string): { from: string; to: string } | null {
    const oldGame = new Chess(oldFen);
    const moves = oldGame.moves({ verbose: true });
    for (const move of moves) {
      const testGame = new Chess(oldFen);
      testGame.move({ from: move.from, to: move.to, promotion: "q" });
      if (testGame.fen() === newFen) return { from: move.from, to: move.to };
    }
    return null;
  }

  // Sincroniza Firebase
  useEffect(() => {
    if (!matchId) return;
    const unsubscribe = onSnapshot(doc(db, "chess_matches", matchId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMatchData(data);
        setGame((currentGame) => {
          if (data.fen !== currentGame.fen()) {
            const newGame = new Chess(data.fen);
            if (previousFen && previousFen !== data.fen) {
              const move = findLastMoveFromFen(previousFen, data.fen);
              if (move) setLastMove(move);
            }
            setPreviousFen(data.fen);
            setWhiteTime(data.whiteTime ?? 600);
            setBlackTime(data.blackTime ?? 600);
            return newGame;
          }
          return currentGame;
        });
      }
    });
    return () => unsubscribe();
  }, [matchId, previousFen]);

  // Busca Nomes dos Jogadores
  useEffect(() => {
    async function fetchNames() {
      if (matchData?.playerWhite) {
        const docSnap = await getDoc(doc(db, "users", matchData.playerWhite));
        if (docSnap.exists()) setWhiteName(docSnap.data().username);
      }
      if (matchData?.playerBlack) {
        const docSnap = await getDoc(doc(db, "users", matchData.playerBlack));
        if (docSnap.exists()) setBlackName(docSnap.data().username);
      }
    }
    fetchNames();
  }, [matchData?.playerWhite, matchData?.playerBlack]);

  // Cronometro
  useEffect(() => {
    if (matchData?.status !== "playing" || game.isGameOver()) return;
    const timer = setInterval(() => {
      if (game.turn() === 'w') setWhiteTime((t) => (t > 0 ? t - 1 : 0));
      else setBlackTime((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [matchData?.status, game.fen()]);

  // Vitoria por Tempo
  useEffect(() => {
    if ((whiteTime === 0 || blackTime === 0) && matchData?.status === "playing" && matchId) {
      updateDoc(doc(db, "chess_matches", matchId), {
        status: "finished",
        winner: whiteTime === 0 ? 'b' : 'w',
        reason: "timeout"
      }).catch(console.error);
    }
  }, [whiteTime, blackTime, matchData?.status, matchId]);

  function getMoveOptions(square: string) {
    const sq = square as Square;
    const moves = game.moves({ square: sq, verbose: true });
    if (moves.length === 0) { setOptionSquares({}); return; }
    
    const newSquares: Record<string, { background: string; borderRadius?: string }> = {};
    newSquares[square] = { background: "rgba(255, 255, 0, 0.4)" };
    
    moves.forEach((move) => {
      const targetSq = typeof move === 'string' ? move : move.to;
      const targetPiece = game.get(targetSq as Square);
      const sourcePiece = game.get(sq);
      
      const isCapture = targetPiece && sourcePiece && targetPiece.color !== sourcePiece.color;
      
      newSquares[targetSq] = {
        background: isCapture ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)" : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    });
    setOptionSquares(newSquares);
  }

  function getSquareStyles(): Record<string, React.CSSProperties> {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: "rgba(255, 255, 0, 0.3)" };
      styles[lastMove.to] = { backgroundColor: "rgba(255, 255, 0, 0.3)" };
    }
    if (game.isCheck()) {
      const kingColor = game.turn();
      game.board().forEach((row, rowIndex) => row.forEach((piece, colIndex) => {
        if (piece?.type === 'k' && piece.color === kingColor) {
          styles[String.fromCharCode(97 + colIndex) + (8 - rowIndex)] = { backgroundColor: "rgba(255, 0, 0, 0.4)" };
        }
      }));
    }
    return { ...styles, ...optionSquares };
  }

  function onSquareClick(square: string) {
    if (matchData?.status !== "playing") return;
    const isPlayerWhite = currentUser?.uid === matchData?.playerWhite;
    if (game.turn() !== (isPlayerWhite ? 'w' : 'b')) return;

    if (moveFrom) {
      const gameCopy = new Chess(game.fen());
      try {
        if (gameCopy.move({ from: moveFrom, to: square, promotion: "q" })) {
          setGame(gameCopy);
          if (matchId) updateDoc(doc(db, "chess_matches", matchId), { fen: gameCopy.fen(), whiteTime, blackTime });
          setMoveFrom(null); setOptionSquares({}); return;
        }
      } catch (e) {}
    }

    const piece = game.get(square as Square);
    if (piece?.color === (isPlayerWhite ? 'w' : 'b')) {
      setMoveFrom(square); getMoveOptions(square);
    } else {
      setMoveFrom(null); setOptionSquares({});
    }
  }

  function onDrop(sourceSquare: string, targetSquare: string): boolean {
    setMoveFrom(null); setOptionSquares({});
    if (matchData?.status !== "playing") return false;
    const isPlayerWhite = currentUser?.uid === matchData.playerWhite;
    if (game.turn() !== (isPlayerWhite ? 'w' : 'b')) return false;

    const gameCopy = new Chess(game.fen());
    try {
      if (gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: "q" })) {
        setGame(gameCopy);
        if (matchId) updateDoc(doc(db, "chess_matches", matchId), { fen: gameCopy.fen(), whiteTime, blackTime });
        return true;
      }
    } catch (e) {}
    return false;
  }

  async function handleResign() {
    if (!matchId) return;
    const winner = currentUser?.uid === matchData.playerWhite ? 'b' : 'w';
    await updateDoc(doc(db, "chess_matches", matchId), { status: "finished", winner, reason: "resign" });
  }

  async function handleOfferDraw() {
    if (!matchId) return;
    const myColor = currentUser?.uid === matchData.playerWhite ? 'w' : 'b';
    await updateDoc(doc(db, "chess_matches", matchId), { drawOffer: myColor });
  }

  async function handleAcceptDraw() {
    if (!matchId) return;
    await updateDoc(doc(db, "chess_matches", matchId), { status: "draw", reason: "agreement", drawOffer: null });
  }

  async function handleDeclineDraw() {
    if (!matchId) return;
    await updateDoc(doc(db, "chess_matches", matchId), { drawOffer: null });
  }

  const formatTime = (time: number) => `${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, '0')}`;
  
  const isWhite = currentUser?.uid === matchData?.playerWhite;
  const boardOrientation = isWhite ? "white" : "black";
  
  const opponentName = isWhite ? blackName : whiteName;
  const opponentTime = isWhite ? blackTime : whiteTime;
  const myName = isWhite ? whiteName : blackName;
  const myTime = isWhite ? whiteTime : blackTime;
  const myColor = isWhite ? 'w' : 'b';

  return (
    <div style={{ minHeight: "100vh", backgroundColor: colors.dark.bg, color: colors.dark.text, padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", boxSizing: "border-box" }}>
      
      {/* Botão Voltar */}
      <div style={{ width: "100%", maxWidth: "1000px", marginBottom: "20px" }}>
        <Button variant="secondary" onClick={() => navigate("/")}>&larr; Voltar ao Hub</Button>
      </div>

      {/* Contentor Principal */}
      <div style={{ width: "100%", maxWidth: "1000px", display: "flex", flexWrap: "wrap", gap: "20px", justifyContent: "center", alignItems: "flex-start" }}>
        
        {/* Lado Esquerdo: Tabuleiro e Jogadores */}
        <div style={{ flex: "2 1 400px", minWidth: "300px", maxWidth: "600px", width: "100%", display: "flex", flexDirection: "column" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", backgroundColor: colors.dark.bgSecondary, borderRadius: "8px 8px 0 0", borderBottom: `1px solid ${colors.dark.border}` }}>
            <span style={{ fontWeight: "600", fontSize: "16px" }}>{opponentName}</span>
            <span style={{ fontFamily: "monospace", fontSize: "1.2rem", backgroundColor: colors.dark.bgTertiary, padding: "4px 8px", borderRadius: "4px" }}>
              {formatTime(opponentTime)}
            </span>
          </div>

          <div style={{ width: "100%", backgroundColor: colors.dark.bgSecondary, boxShadow: "0px 4px 15px rgba(0,0,0,0.3)" }}>
            <Chessboard
              options={{
                position: game.fen(),
                onPieceDrop: ({ sourceSquare, targetSquare }) => sourceSquare && targetSquare ? onDrop(sourceSquare, targetSquare) : false,
                onSquareClick: ({ square }) => square && onSquareClick(square),
                pieces: customPieces,
                boardOrientation,
                squareStyles: getSquareStyles(),
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", backgroundColor: colors.dark.bgSecondary, borderRadius: "0 0 8px 8px", borderTop: `1px solid ${colors.dark.border}` }}>
            <span style={{ fontWeight: "600", fontSize: "16px" }}>{myName} (Você)</span>
            <span style={{ fontFamily: "monospace", fontSize: "1.2rem", backgroundColor: colors.dark.bgTertiary, padding: "4px 8px", borderRadius: "4px" }}>
              {formatTime(myTime)}
            </span>
          </div>
        </div>

        {/* Lado Direito: Ações e Chat */}
        <div style={{ flex: "1 1 300px", minWidth: "300px", maxWidth: "400px", width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {matchData?.drawOffer && matchData.drawOffer !== myColor && matchData.status === "playing" && (
            <div style={{ padding: "16px", backgroundColor: colors.dark.bgSecondary, borderRadius: "8px", border: `2px solid ${colors.primary}`, display: "flex", flexDirection: "column", gap: "12px" }}>
              <span style={{ fontWeight: "600", textAlign: "center" }}>Oponente ofereceu empate!</span>
              <div style={{ display: "flex", gap: "10px" }}>
                <Button variant="primary" fullWidth onClick={handleAcceptDraw}>Aceitar</Button>
                <Button variant="secondary" fullWidth onClick={handleDeclineDraw}>Recusar</Button>
              </div>
            </div>
          )}

          {matchData?.status === "finished" && (
            <div style={{ padding: "20px", backgroundColor: colors.dark.bgSecondary, borderRadius: "8px", textAlign: "center", border: `2px solid ${matchData.winner === myColor ? colors.primary : colors.danger}` }}>
              <h3 style={{ margin: "0 0 10px 0" }}>Fim de jogo!</h3>
              <p style={{ margin: 0, color: colors.dark.textSecondary }}>{matchData.winner === myColor ? "Você venceu!" : "Você perdeu."} ({matchData.reason})</p>
            </div>
          )}

          {matchData?.status === "draw" && (
             <div style={{ padding: "20px", backgroundColor: colors.dark.bgSecondary, borderRadius: "8px", textAlign: "center", border: `2px solid ${colors.dark.border}` }}>
               <h3 style={{ margin: "0 0 10px 0" }}>Empate!</h3>
               <p style={{ margin: 0, color: colors.dark.textSecondary }}>({matchData.reason})</p>
             </div>
          )}

          <div style={{ flex: 1, minHeight: "350px", backgroundColor: colors.dark.bgSecondary, borderRadius: "8px", border: `1px solid ${colors.dark.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.dark.border}`, fontWeight: "600", fontSize: "14px", backgroundColor: colors.dark.bgTertiary }}>
              Chat da Partida
            </div>
            <div style={{ flex: 1, padding: "16px", overflowY: "auto", color: colors.dark.textSecondary, fontSize: "14px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <p style={{ textAlign: "center", fontStyle: "italic", margin: 0 }}>Sala de chat iniciada. (Em breve)</p>
            </div>
            <div style={{ padding: "12px", borderTop: `1px solid ${colors.dark.border}`, display: "flex", gap: "8px", backgroundColor: colors.dark.bg }}>
              <input 
                type="text" 
                placeholder="Mensagem..." 
                disabled
                style={{ flex: 1, padding: "10px 12px", borderRadius: "6px", border: `1px solid ${colors.dark.border}`, backgroundColor: colors.dark.bgTertiary, color: colors.dark.text, outline: "none" }} 
              />
              <Button variant="primary" disabled style={{ opacity: 0.5 }}>Enviar</Button>
            </div>
          </div>

          {matchData?.status === "playing" && (
            <div style={{ display: "flex", gap: "12px", backgroundColor: colors.dark.bgSecondary, padding: "16px", borderRadius: "8px", border: `1px solid ${colors.dark.border}` }}>
              <Button 
                variant="secondary" 
                fullWidth
                onClick={handleOfferDraw} 
                disabled={matchData.drawOffer === myColor}
                style={{ fontWeight: "600", padding: "12px 0" }}
              >
                {matchData.drawOffer === myColor ? "Empate Enviado" : "Oferecer Empate"}
              </Button>
              <Button 
                variant="danger" 
                fullWidth 
                onClick={handleResign}
                style={{ fontWeight: "600", padding: "12px 0" }}
              >
                Desistir
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}