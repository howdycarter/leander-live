// Render-test entry (CHR-2011). Bundled by scripts/lib/render.test.mjs with Vite in SSR mode.
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { EventCard } from "../../src/site/content";
import type { LiveEvent } from "../../src/data/types";

export function renderCard(event: LiveEvent): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <EventCard event={event} saved={false} onToggleSaved={() => {}} />
    </MemoryRouter>,
  );
}
