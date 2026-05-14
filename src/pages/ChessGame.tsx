import { useEffect, useState } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";

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

  const navigate = useNavigate();

  function findLastMoveFromFen(oldFen: string, newFen: string): { from: string; to: string } | null {
    const oldGame = new Chess();
    oldGame.load(oldFen);
    const moves = oldGame.moves({ verbose: true });

    for (const move of moves) {
      const testGame = new Chess(oldFen);
      testGame.move({ from: move.from, to: move.to, promotion: "q" });
      if (testGame.fen() === newFen) {
        return { from: move.from, to: move.to };
      }
    }
    return null;
  }

  // Sincroniza dados do Firebase
  useEffect(() => {
    if (!matchId) return;
    
    const unsubscribe = onSnapshot(doc(db, "chess_matches", matchId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMatchData(data);
        
        setGame((currentGame) => {
          if (data.fen !== currentGame.fen()) {
            const newGame = new Chess();
            newGame.load(data.fen);
            
            if (previousFen && previousFen !== data.fen) {
              const move = findLastMoveFromFen(previousFen, data.fen);
              if (move) {
                setLastMove(move);
              }
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

  // Cronometro decrementa a cada 1 segundo
  useEffect(() => {
    if (matchData?.status !== "playing" || game.isGameOver()) return;

    const timer = setInterval(() => {
      if (game.turn() === 'w') {
        setWhiteTime((t) => (t > 0 ? t - 1 : 0));
      } else {
        setBlackTime((t) => (t > 0 ? t - 1 : 0));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [matchData?.status, game.fen()]);

  // Finaliza a partida ao zerar o tempo
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

    if (moves.length === 0) {
      setOptionSquares({});
      return;
    }

    const newSquares: Record<string, { background: string; borderRadius?: string }> = {};
    newSquares[square] = { background: "rgba(255, 255, 0, 0.4)" };

    moves.forEach((move) => {
      const targetSq = typeof move === 'string' ? move : move.to;
      const targetPiece = game.get(targetSq as Square);
      const sourcePiece = game.get(sq);
      
      const isCapture = targetPiece && sourcePiece && targetPiece.color !== sourcePiece.color;

      newSquares[targetSq] = {
        background: isCapture
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    });

    setOptionSquares(newSquares);
  }

  function getSquareStyles(): Record<string, React.CSSProperties> {
    const styles: Record<string, React.CSSProperties> = {};
    
    if (lastMove) {
      styles[lastMove.from] = {
        backgroundColor: "rgba(255, 255, 0, 0.3)",
      };
      styles[lastMove.to] = {
        backgroundColor: "rgba(255, 255, 0, 0.3)",
      };
    }

    if (game.isCheck()) {
      const board = game.board();
      const kingColor = game.turn();
      
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = board[row][col];
          if (piece && piece.type === 'k' && piece.color === kingColor) {
            const square = String.fromCharCode(97 + col) + (8 - row);
            styles[square] = {
              backgroundColor: "rgba(255, 0, 0, 0.4)",
            };
          }
        }
      }
    }

    return { ...styles, ...optionSquares };
  }

  function onSquareClick(square: string) {
    if (matchData?.status !== "playing") return;
    
    const isWhiteTurn = game.turn() === 'w';
    const isPlayerWhite = currentUser?.uid === matchData?.playerWhite;
    const isPlayerBlack = currentUser?.uid === matchData?.playerBlack;

    if ((isWhiteTurn && !isPlayerWhite) || (!isWhiteTurn && !isPlayerBlack)) {
      return;
    }

    if (moveFrom) {
      const gameCopy = new Chess(game.fen());
      try {
        const move = gameCopy.move({
          from: moveFrom,
          to: square,
          promotion: "q",
        });

        if (move) {
          setGame(gameCopy);
          setLastMove(null);
          if (matchId) {
            updateDoc(doc(db, "chess_matches", matchId), { 
              fen: gameCopy.fen(),
              whiteTime,
              blackTime
            }).catch(console.error);
          }
          setMoveFrom(null);
          setOptionSquares({});
          return;
        }
      } catch (e) {
      }
    }

    const piece = game.get(square as Square);
    if (piece && piece.color === (isPlayerWhite ? 'w' : 'b')) {
      setMoveFrom(square);
      getMoveOptions(square);
    } else {
      setMoveFrom(null);
      setOptionSquares({});
    }
  }

  function onDrop(sourceSquare: string, targetSquare: string): boolean {
    setMoveFrom(null);
    setOptionSquares({});

    if (matchData?.status !== "playing") return false;

    const isWhiteTurn = game.turn() === 'w';
    const isPlayerWhite = currentUser?.uid === matchData.playerWhite;
    const isPlayerBlack = currentUser?.uid === matchData.playerBlack;

    if ((isWhiteTurn && !isPlayerWhite) || (!isWhiteTurn && !isPlayerBlack)) {
      return false;
    }

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
      if (!move) return false;
    } catch (e) {
      return false; 
    }

    setGame(gameCopy);
    setLastMove(null);
    
    if (matchId) {
      updateDoc(doc(db, "chess_matches", matchId), { 
        fen: gameCopy.fen(),
        whiteTime,
        blackTime
      }).catch(console.error);
    }
    
    return true;
  }

  // Acoes da partida
  async function handleResign() {
    if (!matchId) return;
    const myColor = currentUser?.uid === matchData.playerWhite ? 'w' : 'b';
    await updateDoc(doc(db, "chess_matches", matchId), {
      status: "finished",
      winner: myColor === 'w' ? 'b' : 'w',
      reason: "resign"
    });
  }

  async function handleOfferDraw() {
    if (!matchId) return;
    const myColor = currentUser?.uid === matchData.playerWhite ? 'w' : 'b';
    await updateDoc(doc(db, "chess_matches", matchId), { drawOffer: myColor });
  }

  async function handleAcceptDraw() {
    if (!matchId) return;
    await updateDoc(doc(db, "chess_matches", matchId), { 
      status: "draw", 
      reason: "agreement",
      drawOffer: null 
    });
  }

  async function handleDeclineDraw() {
    if (!matchId) return;
    await updateDoc(doc(db, "chess_matches", matchId), { drawOffer: null });
  }

  const formatTime = (time: number) => `${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, '0')}`;

  const isWhiteTurn = game.turn() === 'w';
  const myColor = currentUser?.uid === matchData?.playerWhite ? 'w' : 'b';
  const opponentDrawOffer = matchData?.drawOffer && matchData.drawOffer !== myColor;

  let turnText = "";
  
  if (matchData?.status === "waiting") {
    turnText = "Aguardando oponente...";
  } else if (matchData?.status === "finished") {
    turnText = `Fim de jogo! Vitória das ${matchData.winner === 'w' ? 'Brancas' : 'Pretas'}`;
  } else if (matchData?.status === "draw" || game.isDraw()) {
    turnText = "Empate!";
  } else if (game.isCheckmate()) {
    turnText = "Xeque-Mate!";
  } else {
    const isMyTurn = (isWhiteTurn && currentUser?.uid === matchData?.playerWhite) || 
                     (!isWhiteTurn && currentUser?.uid === matchData?.playerBlack);
    turnText = isMyTurn ? "Sua vez de jogar!" : "Aguarde a jogada do oponente...";
  }

  const boardOrientation = currentUser?.uid === matchData?.playerBlack ? "black" : "white";

  return (
    <div style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center", fontFamily: "sans-serif" }}>
      <button onClick={() => navigate("/")} style={{ marginBottom: "20px", padding: "8px 16px", cursor: "pointer" }}>
        Voltar ao Hub
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontWeight: "bold" }}>
        <span style={{ color: "black", backgroundColor: "white", padding: "4px 8px", borderRadius: "4px", border: "1px solid black" }}>
          Brancas: {formatTime(whiteTime)}
        </span>
        <span style={{ color: "white", backgroundColor: "black", padding: "4px 8px", borderRadius: "4px", border: "1px solid black" }}>
          Pretas: {formatTime(blackTime)}
        </span>
      </div>

      <div style={{
        padding: "10px",
        marginBottom: "20px",
        backgroundColor: game.isCheckmate() || matchData?.status === "finished" ? "#ffcccc" : (turnText === "Sua vez de jogar!" ? "#d4edda" : "#f8d7da"),
        color: game.isCheckmate() || matchData?.status === "finished" ? "#721c24" : (turnText === "Sua vez de jogar!" ? "#155724" : "#721c24"),
        borderRadius: "8px",
        fontWeight: "bold",
        border: "1px solid",
        borderColor: game.isCheckmate() || matchData?.status === "finished" ? "#f5c6cb" : (turnText === "Sua vez de jogar!" ? "#c3e6cb" : "#f5c6cb")
      }}>
        {turnText}
        {game.isCheck() && !game.isCheckmate() && " (Xeque!)"}
      </div>

      {opponentDrawOffer && matchData?.status === "playing" && (
        <div style={{ padding: "10px", marginBottom: "10px", backgroundColor: "#fff3cd", border: "1px solid #ffeeba", borderRadius: "8px" }}>
          <p style={{ margin: "0 0 10px 0" }}>Oponente ofereceu empate!</p>
          <button onClick={handleAcceptDraw} style={{ marginRight: "10px", backgroundColor: "#28a745", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>Aceitar</button>
          <button onClick={handleDeclineDraw} style={{ backgroundColor: "#dc3545", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>Recusar</button>
        </div>
      )}
      
      <div style={{ boxShadow: "0px 4px 10px rgba(0,0,0,0.5)", marginBottom: "20px" }}>
        <Chessboard
          options={{
            position: game.fen(),
            onPieceDrop: ({ sourceSquare, targetSquare }) =>
              sourceSquare && targetSquare ? onDrop(sourceSquare, targetSquare) : false,
            onSquareClick: ({ square }) => square && onSquareClick(square),
            pieces: customPieces,
            boardOrientation,
            squareStyles: getSquareStyles(),
          }}
        />
      </div>

      {matchData?.status === "playing" && (
        <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
          <button onClick={handleOfferDraw} disabled={matchData.drawOffer === myColor} style={{ padding: "8px 16px", cursor: matchData.drawOffer === myColor ? "default" : "pointer" }}>
            {matchData.drawOffer === myColor ? "Empate Oferecido..." : "Oferecer Empate"}
          </button>
          <button onClick={handleResign} style={{ padding: "8px 16px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
            Desistir
          </button>
        </div>
      )}
    </div>
  );
}