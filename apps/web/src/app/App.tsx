import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './components/AuthGuards';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  CreateAccountPage,
  PasswordRecoveryPage,
  SignInPage,
  UpdatePasswordPage,
} from './pages/AuthPages';
import { LandingPage } from './pages/LandingPage';
import { ProjectResourcesPage } from './pages/ProjectResourcesPage';
import { ProjectTopicsPage } from './pages/ProjectTopicsPage';
import { ProjectGenerationPage } from './pages/ProjectGenerationPage';
import { ProjectQuestionsPage } from './pages/ProjectQuestionsPage';
import { ProjectExportStudioPage } from './pages/ProjectExportStudioPage';
import { ProjectPracticeStudioPage } from './pages/ProjectPracticeStudioPage';
import { WorkspacePage } from './pages/WorkspacePage';

function LegacyProjectRedirect() {
  const { projectId, '*': rest } = useParams<{ projectId: string; '*': string }>();
  return <Navigate to={`/app/projects/${projectId}/${rest || 'resources'}`} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route
          element={
            <GuestRoute>
              <SignInPage />
            </GuestRoute>
          }
          path="/sign-in"
        />
        <Route
          element={
            <GuestRoute>
              <CreateAccountPage />
            </GuestRoute>
          }
          path="/sign-up"
        />
        <Route
          element={
            <GuestRoute>
              <PasswordRecoveryPage />
            </GuestRoute>
          }
          path="/password-recovery"
        />
        <Route element={<UpdatePasswordPage />} path="/update-password" />
        <Route
          element={
            <ProtectedRoute>
              <WorkspacePage />
            </ProtectedRoute>
          }
          path="/app"
        />
        <Route
          element={
            <ProtectedRoute>
              <ProjectResourcesPage />
            </ProtectedRoute>
          }
          path="/app/projects/:projectId/resources"
        />
        <Route
          element={
            <ProtectedRoute>
              <ProjectTopicsPage />
            </ProtectedRoute>
          }
          path="/app/projects/:projectId/topics"
        />
        <Route
          element={
            <ProtectedRoute>
              <ProjectGenerationPage />
            </ProtectedRoute>
          }
          path="/app/projects/:projectId/generation"
        />
        <Route
          element={
            <ProtectedRoute>
              <ProjectQuestionsPage />
            </ProtectedRoute>
          }
          path="/app/projects/:projectId/questions"
        />
        <Route
          element={
            <ProtectedRoute>
              <ProjectExportStudioPage />
            </ProtectedRoute>
          }
          path="/app/projects/:projectId/export"
        />
        <Route
          element={
            <ProtectedRoute>
              <ProjectPracticeStudioPage />
            </ProtectedRoute>
          }
          path="/app/projects/:projectId/practice"
        />
        {/* Legacy / Direct project aliases redirecting to /app/projects/:projectId/* */}
        <Route
          element={
            <ProtectedRoute>
              <LegacyProjectRedirect />
            </ProtectedRoute>
          }
          path="/projects/:projectId/*"
        />
        {/* Wildcard 404 Fallback - never show blank page */}
        <Route element={<Navigate to="/app" replace />} path="*" />
      </Routes>
    </ErrorBoundary>
  </BrowserRouter>
);
}
