// authUtils.js
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../firebaseConfig";

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return { success: true, user };
  } catch (error) {
    console.error("Error during login:", error);
    return { success: false, error };
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Error during logout:", error);
    return { success: false, error };
  }
};
