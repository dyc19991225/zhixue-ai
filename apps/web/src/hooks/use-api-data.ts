import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/auth-provider";
import { api } from "@/lib/api";
export function useApiData<T>(path: string | null, refreshKey = 0) {
  const { user } = useAuth();
  const identity = user?.id ?? "guest";
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    identity: string;
    path: string | null;
    data?: T;
    error: string;
    loading: boolean;
  }>({ identity, path: null, error: "", loading: false });
  useEffect(() => {
    let active = true;
    setState({ identity, path, error: "", loading: !!path });
    if (path)
      api<T>(path)
        .then((data) => {
          if (active)
            setState({ identity, path, data, error: "", loading: false });
        })
        .catch((cause: unknown) => {
          if (active)
            setState({
              identity,
              path,
              error:
                cause instanceof Error ? cause.message : "加载失败，请重试。",
              loading: false,
            });
        });
    return () => {
      active = false;
    };
  }, [path, identity, revision, refreshKey]);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  return {
    data:
      state.path === path && state.identity === identity
        ? state.data
        : undefined,
    error:
      state.path === path && state.identity === identity ? state.error : "",
    loading:
      state.path !== path || state.identity !== identity || state.loading,
    reload,
  };
}
