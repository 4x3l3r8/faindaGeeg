import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { OpportunityDetailPage } from './pages/OpportunityDetailPage';
import { ProblemsPage } from './pages/ProblemsPage';
import { ServiceIdeasPage } from './pages/ServiceIdeasPage';
import { SettingsPage } from './pages/SettingsPage';
import { SkillsPage } from './pages/SkillsPage';
import { SourcesPage } from './pages/SourcesPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="opportunities" element={<OpportunitiesPage />} />
        <Route path="opportunities/:id" element={<OpportunityDetailPage />} />
        <Route path="problems" element={<ProblemsPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="service-ideas" element={<ServiceIdeasPage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
