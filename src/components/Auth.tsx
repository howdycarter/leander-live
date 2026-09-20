import { useState } from "react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { trackEvent } from "../site/analytics";
import { User, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.7 2.9v.1C3.4 21.5 7.4 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.7-2.9-.1.1C.5 8.3 0 10.1 0 12s.5 3.7 1.3 5.3l3.9-2.9z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2.1-.1C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.5 1.3 6.7l3.9 2.9c1-2.9 3.7-4.9 6.8-4.9z"
      />
    </svg>
  );
}

function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.98-.2 1.92-.87 3.03-.83 1.32.11 2.31.63 2.97 1.57-2.73 1.63-2.28 5.22.44 6.23-.6 1.57-1.38 3.12-2.52 4.2zm-2.2-15.6c-.5 1.2-1.94 2.13-3.13 2.02.12-1.23 1.05-2.29 2.06-2.7.5-.21 1.07-.36 1.07.68z" />
    </svg>
  );
}

export function SignInDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { signIn } = useAuthActions();
  const [pending, setPending] = useState<"google" | "apple" | null>(null);

  function start(provider: "google" | "apple") {
    setPending(provider);
    trackEvent("sign_in_started", { provider });
    // Redirects to the provider; Convex handles the OAuth callback.
    void signIn(provider).catch(() => setPending(null));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#eadbc3] bg-[#fffdf8] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Welcome to <span className="text-[#b5431f]">Leander Live</span>
          </DialogTitle>
          <DialogDescription>
            Sign in to sync your saved events across devices and get reminders
            that follow you. No spam, ever.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending !== null}
            onClick={() => start("google")}
            className="h-12 justify-center gap-3 rounded-full border-[#d8c9ae] bg-white text-base font-semibold text-[#3c4043] hover:bg-[#f8f5ef]"
          >
            {pending === "google" ? (
              "Redirecting…"
            ) : (
              <>
                <GoogleMark className="h-5 w-5" /> Continue with Google
              </>
            )}
          </Button>
          <Button
            type="button"
            disabled={pending !== null}
            onClick={() => start("apple")}
            className="h-12 justify-center gap-3 rounded-full bg-black text-base font-semibold text-white hover:bg-[#222]"
          >
            {pending === "apple" ? (
              "Redirecting…"
            ) : (
              <>
                <AppleMark className="h-5 w-5" /> Continue with Apple
              </>
            )}
          </Button>
          <p className="pt-1 text-center text-xs text-muted-foreground">
            By continuing you agree to receive only the reminders you ask for.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Header account control: User icon when logged out (opens sign-in),
 * initial-avatar with sign-out menu when logged in.
 */
export function AccountButton({ onSignIn }: { onSignIn: () => void }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer);
  const { signOut } = useAuthActions();

  const circleClass =
    "h-10 w-10 rounded-full border border-[#eadbc3] bg-white text-[#4a3d2f] hover:border-[#db5a1e] hover:text-[#b5431f]";

  if (isLoading || (isAuthenticated && viewer === undefined)) {
    return <Skeleton className="h-10 w-10 rounded-full" aria-label="Checking sign-in status" />;
  }

  if (!isAuthenticated || !viewer) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onSignIn}
        aria-label="Sign in"
        className={circleClass}
      >
        <User className="h-4 w-4" />
      </Button>
    );
  }

  const initial = (viewer.name ?? viewer.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="default"
          size="icon"
          aria-label={`Account: ${viewer.name ?? viewer.email ?? "signed in"}`}
          className={cn(
            circleClass,
            "border-[#db5a1e] bg-[#db5a1e] font-display text-lg font-bold text-white hover:bg-[#b5431f] hover:text-white",
          )}
        >
          {initial}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 border-[#eadbc3] bg-[#fffdf8]">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold text-[#2e2620]">
            {viewer.name ?? "Leander local"}
          </p>
          {viewer.email && (
            <p className="truncate text-xs text-muted-foreground">{viewer.email}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[#eadbc3]" />
        <DropdownMenuItem
          onSelect={() => void signOut()}
          className="cursor-pointer text-[#b5431f] focus:text-[#b5431f]"
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
