import { BrowserRouter, Route, Routes } from 'react-router-dom';
import {
  CreateAccountPage,
  PasswordRecoveryPage,
  SignInPage,
} from './pages/AuthPages';
import { LandingPage } from './pages/LandingPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route element={<SignInPage />} path="/sign-in" />
        <Route element={<CreateAccountPage />} path="/sign-up" />
        <Route element={<PasswordRecoveryPage />} path="/password-recovery" />
      </Routes>
    </BrowserRouter>
  );
}
