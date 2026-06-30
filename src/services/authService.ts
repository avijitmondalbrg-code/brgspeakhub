import {
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";

import { auth, googleProvider } from "../firebase";

export async function signInWithGoogle() {
  return await signInWithPopup(auth, googleProvider);
}

export async function signInAsAdmin(email: string, password: string) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return await signOut(auth);
}

export function authStateListener(
  callback: (user: User | null) => void
) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}
