export type IdeOverlayId = "editor" | "codex" | "citations";

const IDE_OVERLAY_EVENT = "observaire:ide-overlay-open";

type IdeOverlayDetail = { id: IdeOverlayId };

export function announceIdeOverlayOpen(id: IdeOverlayId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<IdeOverlayDetail>(IDE_OVERLAY_EVENT, { detail: { id } }));
}

export function listenForOtherIdeOverlay(id: IdeOverlayId, onOtherOpen: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<IdeOverlayDetail>).detail;
    if (detail?.id && detail.id !== id) onOtherOpen();
  };
  window.addEventListener(IDE_OVERLAY_EVENT, handler);
  return () => window.removeEventListener(IDE_OVERLAY_EVENT, handler);
}
