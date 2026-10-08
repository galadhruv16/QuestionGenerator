import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSupabaseClient } from '../../lib/supabase';
import {
  AuthShell,
  GoogleButton,
  Icon,
  PortalDivider,
  PortalField,
} from '../components/ui';

export function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: signInError } =
        await getSupabaseClient().auth.signInWithPassword({
          email,
          password,
        });
      if (signInError) throw signInError;
      navigate('/app');
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : 'Unable to sign in.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const { error: oauthError } =
        await getSupabaseClient().auth.signInWithOAuth({
          options: { redirectTo: `${window.location.origin}/app` },
          provider: 'google',
        });
      if (oauthError) throw oauthError;
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : 'Unable to start Google sign-in.',
      );
    }
  };

  return (
    <AuthShell>
      <section
        aria-labelledby="sign-in-title"
        className="portal-card sign-in-card"
      >
        <div className="auth-tabs">
          <span className="is-active">Sign in</span>
          <Link to="/sign-up">Create account</Link>
        </div>
        <div className="portal-card-heading">
          <span className="portal-protocol">VERIFIED ACADEMIC ACCESS</span>
          <h1 id="sign-in-title">Welcome back</h1>
          <p>
            Sign in to access your questions, study corpus, and validated banks.
          </p>
        </div>
        <GoogleButton disabled={isSubmitting} onClick={signInWithGoogle} />
        <PortalDivider />
        <form onSubmit={signIn}>
          <PortalField
            action="SSO Enabled"
            id="institutional-email"
            inputProps={{
              autoComplete: 'email',
              onChange: (event) => setEmail(event.target.value),
              required: true,
              value: email,
            }}
            label="Institutional Email"
            placeholder="m.faculty@oxford.ac.uk"
            type="email"
          />
          <PortalField
            action="Forgot password?"
            id="sign-in-password"
            inputProps={{
              autoComplete: 'current-password',
              onChange: (event) => setPassword(event.target.value),
              required: true,
              value: password,
            }}
            label="Password"
            placeholder="••••••••••"
            type="password"
          />
          <label className="portal-check" htmlFor="remember-me">
            <input id="remember-me" type="checkbox" />
            Remember me for 30 days
          </label>
          {error && (
            <p className="portal-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="portal-submit"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}{' '}
            <Icon name="arrow" size={14} />
          </button>
        </form>
        <p className="portal-switch">
          Don&apos;t have an account?{' '}
          <Link to="/sign-up">Create an account</Link>
        </p>
        <p className="portal-local-note">
          Sign in with local/Ollama Federation
        </p>
        <p className="portal-quote">“Grounded knowledge. Better questions.”</p>
      </section>
    </AuthShell>
  );
}

export function CreateAccountPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error: signUpError } =
        await getSupabaseClient().auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });
      if (signUpError) throw signUpError;
      if (data.session) {
        navigate('/app');
      } else {
        setNotice('Check your email to confirm your account, then sign in.');
      }
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : 'Unable to create your account.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const signUpWithGoogle = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: oauthError } =
        await getSupabaseClient().auth.signInWithOAuth({
          options: { redirectTo: `${window.location.origin}/app` },
          provider: 'google',
        });
      if (oauthError) throw oauthError;
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : 'Unable to start Google sign-up.',
      );
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <section
        aria-labelledby="create-account-title"
        className="portal-card create-account-card"
      >
        <div className="auth-tabs compact-tabs">
          <span className="is-active">Create Account</span>
          <Link to="/sign-in">Sign in</Link>
        </div>
        <div className="portal-card-heading">
          <span className="portal-protocol protocol-teal">
            INSTITUTIONAL PROTOCOL V1.0.5
          </span>
          <h1 id="create-account-title">Create your account</h1>
          <p>
            Transform your academic literature into verified, higher-order
            questions.
          </p>
        </div>
        <GoogleButton disabled={isSubmitting} onClick={signUpWithGoogle} />
        <PortalDivider />
        <form onSubmit={createAccount}>
          <PortalField
            id="full-name"
            inputProps={{
              autoComplete: 'name',
              onChange: (event) => setFullName(event.target.value),
              required: true,
              value: fullName,
            }}
            label="Full Name"
            placeholder="Dr. Diana Rostova"
          />
          <PortalField
            action="Scholar Identity"
            id="create-email"
            inputProps={{
              autoComplete: 'email',
              onChange: (event) => setEmail(event.target.value),
              required: true,
              value: email,
            }}
            label="Institutional / Academic Email"
            placeholder="d.rostova@oxford.edu"
            type="email"
          />
          <p className="portal-hint">
            Invitation or verified SSO access recommended for verification.
          </p>
          <PortalField
            action="Key Strength"
            id="create-password"
            inputProps={{
              autoComplete: 'new-password',
              minLength: 8,
              onChange: (event) => setPassword(event.target.value),
              required: true,
              value: password,
            }}
            label="Password"
            placeholder="••••••••••"
            type="password"
          />
          <div aria-label="Password strength" className="password-meter">
            <span />
            <span />
            <span />
            <span />
            <small>Strong</small>
          </div>
          <div className="password-rules">
            <span>8+ chars</span>
            <span>Mixed case</span>
            <span>1+ symbol</span>
          </div>
          <PortalField
            action="Re-enter"
            id="confirm-password"
            inputProps={{
              autoComplete: 'new-password',
              minLength: 8,
              onChange: (event) => setConfirmPassword(event.target.value),
              required: true,
              value: confirmPassword,
            }}
            label="Confirm Password"
            placeholder="••••••••••"
            type="password"
          />
          <label className="portal-consent" htmlFor="research-consent">
            <input id="research-consent" required type="checkbox" /> GroundQ
            provides sovereign cognitive control over question generation for
            educators, researchers, and technical practitioners.
          </label>
          {error && (
            <p className="portal-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="portal-notice" role="status">
              {notice}
            </p>
          )}
          <button
            className="portal-submit"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}{' '}
            <Icon name="arrow" size={14} />
          </button>
        </form>
        <p className="portal-legal">
          By continuing, you agree to GroundQ&apos;s{' '}
          <a href="#terms">Terms of Service</a> and{' '}
          <a href="#privacy">Privacy Policy</a>.
        </p>
        <p className="portal-switch">
          Already have an account? <Link to="/sign-in">Sign in</Link>
        </p>
      </section>
    </AuthShell>
  );
}

export function PasswordRecoveryPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      const { error: resetError } =
        await getSupabaseClient().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`,
        });
      if (resetError) throw resetError;
      setNotice(
        'If an account exists for this email, a reset link has been sent.',
      );
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : 'Unable to send a reset link.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <section
        aria-labelledby="recovery-title"
        className="portal-card recovery-card"
      >
        <div className="portal-card-heading recovery-heading">
          <span className="recovery-mark">▣</span>
          <span className="portal-protocol">GROUNDQ / AUTH PROTOCOL</span>
          <span className="portal-protocol">INSTITUTIONAL ACCESS PORTAL</span>
          <h1 id="recovery-title">Reset your password</h1>
          <p>
            Enter the email address associated with your GroundQ account and we
            will send you a secure verification link.
          </p>
        </div>
        <form onSubmit={resetPassword}>
          <PortalField
            action="Receive validation link"
            id="recovery-email"
            inputProps={{
              autoComplete: 'email',
              onChange: (event) => setEmail(event.target.value),
              required: true,
              value: email,
            }}
            label="Institutional Email Address"
            placeholder="d.rostova@institution.edu"
            type="email"
          />
          <div className="recovery-notice">
            <span>↗</span>
            <p>
              Single-use Token Expires
              <br />
              Issued tokens expire after 30 minutes. Multiple consecutive
              requests will invalidate prior tokens.
            </p>
          </div>
          {error && (
            <p className="portal-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="portal-notice" role="status">
              {notice}
            </p>
          )}
          <button
            className="portal-submit"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Sending…' : 'Send reset link'}{' '}
            <Icon name="arrow" size={14} />
          </button>
        </form>
        <Link className="portal-back-link" to="/sign-in">
          <Icon name="arrow" size={13} /> Back to sign in
        </Link>
      </section>
    </AuthShell>
  );
}

export function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await getSupabaseClient().auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      await getSupabaseClient().auth.signOut();
      navigate('/sign-in', { replace: true });
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : 'Unable to update your password.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <section
        aria-labelledby="update-password-title"
        className="portal-card recovery-card"
      >
        <div className="portal-card-heading recovery-heading">
          <span className="portal-protocol">GROUNDQ / AUTH PROTOCOL</span>
          <h1 id="update-password-title">Choose a new password</h1>
          <p>Set a new password for your GroundQ account.</p>
        </div>
        <form onSubmit={updatePassword}>
          <PortalField
            id="new-password"
            inputProps={{
              autoComplete: 'new-password',
              minLength: 8,
              onChange: (event) => setPassword(event.target.value),
              required: true,
              value: password,
            }}
            label="New password"
            placeholder="••••••••••"
            type="password"
          />
          <PortalField
            id="confirm-new-password"
            inputProps={{
              autoComplete: 'new-password',
              minLength: 8,
              onChange: (event) => setConfirmPassword(event.target.value),
              required: true,
              value: confirmPassword,
            }}
            label="Confirm new password"
            placeholder="••••••••••"
            type="password"
          />
          {error && (
            <p className="portal-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="portal-submit"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Updating…' : 'Update password'}{' '}
            <Icon name="arrow" size={14} />
          </button>
        </form>
        <Link className="portal-back-link" to="/sign-in">
          <Icon name="arrow" size={13} /> Back to sign in
        </Link>
      </section>
    </AuthShell>
  );
}
