/** Sharing helpers do not send messages or assume that a native handoff delivered one. */
export type NativeShareState = "idle" | "unavailable" | "pending" | "busy" | "canceled" | "failed" | "completed";
export type LinkCopyState = "idle" | "unavailable" | "pending" | "busy" | "failed" | "copied";
export interface EventShareData { title: string; text?: string; url: string; }

export const NATIVE_SHARE_MESSAGES: Record<NativeShareState, string> = {
  idle: "Use your device’s sharing options, or copy the link below.",
  unavailable: "Device sharing is unavailable in this browser. Copy or select the link below.",
  pending: "Opening device sharing… If it does not open, copy or select the link below.",
  busy: "Another sharing request is still finishing. You can copy or select the link below.",
  canceled: "Sharing canceled. You can still copy or select the link below.",
  failed: "Device sharing could not finish. Copy or select the link below instead.",
  completed: "Device sharing finished. Delivery is not confirmed; the link is still available below.",
};
export const LINK_COPY_MESSAGES: Record<LinkCopyState, string> = {
  idle: "Copying a link does not send it to anyone.",
  unavailable: "Clipboard unavailable. Select and copy the event link manually.",
  pending: "Copying link… You can also select and copy it manually.",
  busy: "An earlier copy is still finishing. Try again, or select the link to copy manually.",
  failed: "The link could not be copied. Select and copy it manually.",
  copied: "Link copied. Paste it wherever you want to share it; nothing was sent here.",
};

/** Deliberately discard query/hash/userinfo, including preview access parameters. */
export function eventShareUrl(origin: string, pathname: string): string {
  const base = new URL(origin);
  if (base.protocol !== "https:" && base.protocol !== "http:") throw new Error("Unsupported event URL origin");
  const url = new URL(base.origin);
  url.pathname = pathname.split(/[?#]/, 1)[0];
  return url.href;
}

/** Locks survive dialog close/unmount: native and clipboard operations cannot be canceled. */
export function createEventShareManager(copyLock = { pending: false }) {
  let nativePending = false;
  return {
    createSession() {
      let generation = 0;
      return {
        invalidate() { generation += 1; },
        async share(
          data: EventShareData,
          nativeShare: ((data: EventShareData) => Promise<void>) | undefined,
          publish: (state: NativeShareState) => void,
        ): Promise<void> {
          if (!nativeShare) { publish("unavailable"); return; }
          if (nativePending) { publish("busy"); return; }
          const request = generation;
          nativePending = true;
          publish("pending");
          try {
            await nativeShare(data);
            if (request === generation) publish("completed");
          } catch (error) {
            if (request === generation) {
              publish(error && typeof error === "object" && "name" in error && error.name === "AbortError" ? "canceled" : "failed");
            }
          } finally {
            nativePending = false;
          }
        },
        async copy(
          url: string,
          writeText: ((text: string) => Promise<void>) | undefined,
          publish: (state: LinkCopyState) => void,
        ): Promise<void> {
          if (!writeText) { publish("unavailable"); return; }
          if (copyLock.pending) { publish("busy"); return; }
          const request = generation;
          copyLock.pending = true;
          publish("pending");
          try {
            await writeText(url);
            if (request === generation) publish("copied");
          } catch {
            if (request === generation) publish("failed");
          } finally {
            copyLock.pending = false;
          }
        },
      };
    },
  };
}
