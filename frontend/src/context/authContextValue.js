import { createContext } from "react";

// Separado do AuthContext.jsx para que aquele arquivo exporte só componentes
// (exigência do Fast Refresh do Vite).
export const AuthContext = createContext(null);

export const STORAGE_TOKEN_KEY = "essencial_token";
export const STORAGE_USER_KEY = "essencial_user";
