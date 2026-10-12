import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './components/AuthGuards';
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
import { WorkspacePage } from './pages/WorkspacePage';

export function App() {
  return (
    <BrowserRouter>
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
      </Routes>
    </BrowserRouter>
  );
}
