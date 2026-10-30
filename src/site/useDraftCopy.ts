import { useLayoutEffect, useState } from "react";
import { createDraftCopyManager, emailDraftText, type EmailDraft } from "./emailDrafts";
import { clipboardWriteLock } from "./clipboardWrites";

// One lock covers every form and survives a form unmount while a write is pending.
const clipboardCopies = createDraftCopyManager(clipboardWriteLock);

export function useDraftCopy(draft: EmailDraft | null, recipient: string, contextKey = "") {
  const [session] = useState(() => clipboardCopies.createSession());
  const [result, setResult] = useState<{
    draft: EmailDraft; recipient: string; contextKey: string; message: string;
  } | null>(null);

  useLayoutEffect(() => {
    session.invalidate();
    setResult(null);
    // Cleanup invalidates pending completions on draft/package changes and unmount.
    return () => session.invalidate();
  }, [session, draft, recipient, contextKey]);

  function resetCopy() {
    // Edit/new-draft actions invalidate immediately, before React commits a render.
    session.invalidate();
    setResult(null);
  }

  async function copyDraft() {
    if (!draft) return;
    await session.copy(
      emailDraftText(draft, recipient),
      (text) => navigator.clipboard.writeText(text),
      (message) => setResult({ draft, recipient, contextKey, message }),
    );
  }

  return {
    copyDraft,
    resetCopy,
    copyStatus: result?.draft === draft && result?.recipient === recipient && result?.contextKey === contextKey
      ? result.message : "",
  };
}
