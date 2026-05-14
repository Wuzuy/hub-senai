import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";

// Registra o usuário e cria o documento base na coleção 'users'
export async function registerUser(email: string, password: string, username: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  await setDoc(doc(db, "users", user.uid), {
    username: username,
    createdAt: new Date(),
    stats: {
      chess: { wins: 0, losses: 0, elo: 1200 }
    }
  });

  return user;
}

// Autentica um usuário existente
export async function loginUser(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}