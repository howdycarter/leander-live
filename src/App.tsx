import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Canonical, RouteMeta, ScrollToTop, SiteLayout } from "./site/chrome";
import { SavedEventsProvider, SiteActionsProvider } from "./site/state";
import { initAnalytics, trackPageView } from "./site/analytics";
import { AccessibilityPage, TermsPage } from "./site/legal";
import {
  AboutPage,
  AdvertisePage,
  CityHallPage,
  CommunityPage,
  EventDetailPage,
  EventsPage,
  HomePage,
  JobsPage,
  NotFoundPage,
  PrivacyPage,
  RemindersPage,
} from "./site/pages";

/* The business directory carries the site's largest dataset (800+ permit
   records), so it ships as its own chunk and loads only on /businesses. */
const BusinessesPage = lazy(() =>
  import("./site/businesses").then((m) => ({ default: m.BusinessesPage })),
);

function RouteFallback() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6">
      <p className="text-sm font-semibold text-foreground/60">Loading the directory…</p>
    </main>
  );
}

/** Initializes analytics (GTM dataLayer) once and reports SPA page views on every route change. */
function Analytics() {
  const location = useLocation();
  useEffect(() => {
    initAnalytics();
  }, []);
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Canonical />
      <RouteMeta />
      <Analytics />
      <SavedEventsProvider>
        <SiteActionsProvider>
          <Routes>
            <Route element={<SiteLayout />}>
              <Route index element={<HomePage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="events/:id" element={<EventDetailPage />} />
              <Route path="jobs" element={<JobsPage />} />
              <Route
                path="businesses"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <BusinessesPage />
                  </Suspense>
                }
              />
              <Route path="city-hall" element={<CityHallPage />} />
              <Route path="community" element={<CommunityPage />} />
              <Route path="reminders" element={<RemindersPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="advertise" element={<AdvertisePage />} />
              <Route path="privacy" element={<PrivacyPage />} />
              <Route path="terms" element={<TermsPage />} />
              <Route path="accessibility" element={<AccessibilityPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </SiteActionsProvider>
      </SavedEventsProvider>
    </BrowserRouter>
  );
}
