import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { currentUser, refreshSession, subscribeSession } from "@/lib/api";
import type { AuthUser } from "@zhixue/shared";
const AuthContext = createContext<{ user: AuthUser | null; loading: boolean }>({
  user: null,
  loading: true,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(currentUser);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsubscribe = subscribeSession(() => setUser(currentUser()));
    let active = true;
    refreshSession()
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
