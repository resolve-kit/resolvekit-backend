import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface DirtyStateContextValue {
  dirtyPages: Set<string>;
  markDirty: (page: string) => void;
  markClean: (page: string) => void;
}

const DirtyStateContext = createContext<DirtyStateContextValue>({
  dirtyPages: new Set(),
  markDirty: () => {},
  markClean: () => {},
});

export function DirtyStateProvider({ children }: { children: ReactNode }) {
  const [dirtyPages, setDirtyPages] = useState<Set<string>>(new Set());

  const markDirty = useCallback((page: string) => {
    setDirtyPages((prev) => {
      if (prev.has(page)) return prev;
      return new Set([...prev, page]);
    });
  }, []);

  const markClean = useCallback((page: string) => {
    setDirtyPages((prev) => {
      if (!prev.has(page)) return prev;
      const next = new Set(prev);
      next.delete(page);
      return next;
    });
  }, []);

  return (
    <DirtyStateContext.Provider value={{ dirtyPages, markDirty, markClean }}>
      {children}
    </DirtyStateContext.Provider>
  );
}

export function useDirtyState() {
  return useContext(DirtyStateContext);
}
