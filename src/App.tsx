import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AdminLeads } from "./components/AdminLeads";
import { Canonical, ScrollToTop, SiteLayout } from "./site/chrome";
import { SavedEventsProvider, SiteActionsProvider } from "./site/state";
import {
  AboutPage,
  CommunityPage,
  EventsPage,
  HomePage,
  JobsPage,
  NotFoundPage,
  PrivacyPage,
  RemindersPage,
} from "./site/pages";

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Canonical />
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
              <Route path="privacy" element={<PrivacyPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </SiteActionsProvider>
      </SavedEventsProvider>
    </BrowserRouter>
  );
}
