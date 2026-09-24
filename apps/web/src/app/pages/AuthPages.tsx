import { Link } from 'react-router-dom';
import {
  AuthShell,
  GoogleButton,
  Icon,
  PortalDivider,
  PortalField,
} from '../components/ui';

export function SignInPage() {
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
        <GoogleButton />
        <PortalDivider />
        <PortalField
          action="SSO Enabled"
          id="institutional-email"
          label="Institutional Email"
          placeholder="m.faculty@oxford.ac.uk"
          type="email"
        />
        <PortalField
          action="Forgot password?"
          id="sign-in-password"
          label="Password"
          placeholder="••••••••••"
          type="password"
        />
        <label className="portal-check" htmlFor="remember-me">
          <input id="remember-me" type="checkbox" />
          Remember me for 30 days
        </label>
        <button className="portal-submit" type="button">
          Sign in <Icon name="arrow" size={14} />
        </button>
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
        <GoogleButton />
        <PortalDivider />
        <PortalField
          id="full-name"
          label="Full Name"
          placeholder="Dr. Diana Rostova"
        />
        <PortalField
          action="Scholar Identity"
          id="create-email"
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
          label="Confirm Password"
          placeholder="••••••••••"
          type="password"
        />
        <label className="portal-consent" htmlFor="research-consent">
          <input id="research-consent" type="checkbox" />
          GroundQ provides sovereign cognitive control over question generation
          for educators, researchers, and technical practitioners.
        </label>
        <button className="portal-submit" type="button">
          Create account <Icon name="arrow" size={14} />
        </button>
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
        <PortalField
          action="Receive validation link"
          id="recovery-email"
          label="Institutional Email Address"
          placeholder="d.rostova@institution.edu"
          type="email"
        />
        <div className="recovery-notice">
          <span>↗</span>
          <p>
            Single-use Token Expires
            <br />
            Issued tokens expire after 30 minutes. Multiple consecutive requests
            will invalidate prior tokens.
          </p>
        </div>
        <button className="portal-submit" type="button">
          Send reset link <Icon name="arrow" size={14} />
        </button>
        <Link className="portal-back-link" to="/sign-in">
          <Icon name="arrow" size={13} /> Back to sign in
        </Link>
      </section>
    </AuthShell>
  );
}
