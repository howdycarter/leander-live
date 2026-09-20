import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AdminLeads } from "./components/AdminLeads";
import { Canonical, ScrollToTop, SiteLayout } from "./site/chrome";
import { SavedEventsProvider, SiteActionsProvider } from "./site/state";
import { initAnalytics, trackPageView } from "./site/analytics";
import {
  AboutPage,
  AdvertisePage,
  CommunityPage,
  EventsPage,
  HomePage,
  JobsPage,
  NotFoundPage,
  PrivacyPage,
  RemindersPage,
} from "./site/pages";

/** Initializes GA4 once and reports SPA page views on every route change. */
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
      <Analytics />
      <SavedEventsProvider>
        <SiteActionsProvider>
          <Routes>
            <Route path="/admin/leads" element={<AdminLeads />} />
            <Route element={<SiteLayout />}>
              <Route index element={<HomePage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="jobs" element={<JobsPage />} />
              <Route path="community" element={<CommunityPage />} />
              <Route path="reminders" element={<RemindersPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="advertise" element={<AdvertisePage />} />
              <Route path="privacy" element={<PrivacyPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </SiteActionsProvider>
      </SavedEventsProvider>
    </BrowserRouter>
  );
}
