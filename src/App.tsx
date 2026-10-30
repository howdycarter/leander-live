import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Canonical, RouteMeta, ScrollToTop, SiteLayout } from "./site/chrome";
import { SavedEventsProvider, SiteActionsProvider } from "./site/state";
import { initAnalytics, trackPageView } from "./site/analytics";
import {
  AboutPage,
  CityHallPage,
  NotFoundPage,
  PrivacyPage,
  RemindersPage,
} from "./site/pages";
import { HomePage, EventsPage, JobsPage, BusinessesPage, SearchPage } from "./site/discovery";
import { EventDetailPage, JobDetailPage, BusinessDetailPage } from "./site/details";
import { SubmitPage, AdvertisePage } from "./site/submissions";

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
              <Route path="jobs/:id" element={<JobDetailPage />} />
              <Route path="businesses/:id" element={<BusinessDetailPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="submit" element={<SubmitPage />} />
              <Route path="businesses" element={<BusinessesPage />} />
              <Route path="city-hall" element={<CityHallPage />} />
              <Route path="community" element={<Navigate to="/advertise" replace />} />
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
