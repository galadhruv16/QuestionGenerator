import { BrowserRouter, Route, Routes } from 'react-router-dom';
import {
  CreateAccountPage,
  PasswordRecoveryPage,
  SignInPage,
  UpdatePasswordPage,
} from './pages/AuthPages';
import { LandingPage } from './pages/LandingPage';
import { WorkspacePage } from './pages/WorkspacePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route element={<SignInPage />} path="/sign-in" />
        <Route element={<CreateAccountPage />} path="/sign-up" />
        <Route element={<PasswordRecoveryPage />} path="/password-recovery" />
        <Route element={<UpdatePasswordPage />} path="/update-password" />
        <Route element={<WorkspacePage />} path="/app" />
      </Routes>
    </BrowserRouter>
  );
}
