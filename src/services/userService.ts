import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: "admin" | "user";
  createdAt?: any;
  lastLogin?: any;
}

export async function createOrUpdateUser(profile: UserProfile) {
  const userRef = doc(db, "users", profile.uid);

  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      ...profile,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    });
  } else {
    await updateDoc(userRef, {
      lastLogin: serverTimestamp(),
      name: profile.name,
      photoURL: profile.photoURL ?? "",
    });
  }
}

export async function getUser(uid: string) {
  const snapshot = await getDoc(doc(db, "users", uid));

  if (!snapshot.exists()) return null;

  return snapshot.data() as UserProfile;
}
