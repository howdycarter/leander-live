import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

/* ---------------- saved events (localStorage only — no backend) ---------------- */

type SavedEventsValue = {
  saved: Set<string>;
  toggleSaved: (id: string) => void;
};

const SavedEventsContext = createContext<SavedEventsValue | null>(null);

const STORAGE_KEY = "leander-live:saved";

export function SavedEventsProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  function toggleSaved(id: string) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* storage unavailable — keep in-memory only */
      }
      return next;
    });
  }

  return (
    <SavedEventsContext.Provider value={{ saved, toggleSaved }}>
      {children}
    </SavedEventsContext.Provider>
  );
}

export function useSavedEvents(): SavedEventsValue {
  const ctx = useContext(SavedEventsContext);
  if (!ctx) throw new Error("useSavedEvents must be used inside SavedEventsProvider");
  return ctx;
}

/* ---------------- global site actions (submit-event dialog) ---------------- */

type SiteActionsValue = {
  openSubmit: () => void;
};

const SiteActionsContext = createContext<SiteActionsValue | null>(null);

export function SiteActionsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return <SiteActionsContext.Provider value={{ openSubmit: () => navigate("/submit?type=event") }}>{children}</SiteActionsContext.Provider>;
}

export function useSiteActions(): SiteActionsValue {
  const ctx = useContext(SiteActionsContext);
  if (!ctx) throw new Error("useSiteActions must be used inside SiteActionsProvider");
  return ctx;
}
