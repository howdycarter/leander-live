import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Dialog } from "@/components/ui/dialog";
import { SubmitDialogContent } from "./content";
import { SignInDialog } from "../components/Auth";

/* ---------------- saved events (shared across pages) ---------------- */

type SavedEventsValue = {
  saved: Set<string>;
  toggleSaved: (id: string) => void;
};

const SavedEventsContext = createContext<SavedEventsValue | null>(null);

export function SavedEventsProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("leander-live:saved");
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  // Signed-in users sync saved events to their profile (Convex Auth).
  const { isAuthenticated } = useConvexAuth();
  const serverSaved = useQuery(api.profiles.getSaved);
  const serverToggleSaved = useMutation(api.profiles.toggleSaved);
  const serverMergeSaved = useMutation(api.profiles.mergeSaved);

  function toggleSaved(id: string) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("leander-live:saved", JSON.stringify([...next]));
      } catch {
        /* storage unavailable — keep in-memory only */
      }
      return next;
    });
    // Persist server-side when signed in (guests stay local-only).
    if (isAuthenticated) {
      serverToggleSaved({ eventId: id as Id<"events"> }).catch(() => {});
    }
  }

  // On sign-in: merge guest (localStorage) saves into the server profile
  // once, then adopt the server list as the source of truth.
  const mergedRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated) {
      mergedRef.current = false;
      return;
    }
    if (mergedRef.current || serverSaved === undefined) return;
    mergedRef.current = true;
    let guestIds: string[] = [];
    try {
      const raw = localStorage.getItem("leander-live:saved");
      guestIds = raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      /* ignore */
    }
    serverMergeSaved({ eventIds: guestIds as Id<"events">[] }).catch(() => {});
  }, [isAuthenticated, serverSaved, serverMergeSaved]);

  useEffect(() => {
    if (!isAuthenticated || !mergedRef.current || serverSaved === undefined) return;
    setSaved(new Set(serverSaved));
    try {
      localStorage.setItem("leander-live:saved", JSON.stringify(serverSaved));
    } catch {
      /* ignore */
    }
  }, [isAuthenticated, serverSaved]);

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

/* ---------------- global site actions (submit / sign-in dialogs) ---------------- */

type SiteActionsValue = {
  openSubmit: () => void;
  openSignIn: () => void;
};

const SiteActionsContext = createContext<SiteActionsValue | null>(null);

export function SiteActionsProvider({ children }: { children: ReactNode }) {
  const [submitOpen, setSubmitOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <SiteActionsContext.Provider
      value={{ openSubmit: () => setSubmitOpen(true), openSignIn: () => setSignInOpen(true) }}
    >
      {children}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <SubmitDialogContent />
      </Dialog>
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </SiteActionsContext.Provider>
  );
}

export function useSiteActions(): SiteActionsValue {
  const ctx = useContext(SiteActionsContext);
  if (!ctx) throw new Error("useSiteActions must be used inside SiteActionsProvider");
  return ctx;
}
