import { useState, type ComponentProps } from 'react';
import { Link } from 'react-router-dom';

export type IconName =
  | 'alert'
  | 'archive'
  | 'arrow'
  | 'arrowUpRight'
  | 'book'
  | 'check'
  | 'chevron'
  | 'close'
  | 'copy'
  | 'database'
  | 'delete'
  | 'edit'
  | 'file'
  | 'folder'
  | 'lock'
  | 'menu'
  | 'network'
  | 'pause'
  | 'pdf'
  | 'refresh'
  | 'replay'
  | 'search'
  | 'shield'
  | 'sliders'
  | 'sort'
  | 'spark'
  | 'tree'
  | 'upload'
  | 'verified';

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    alert: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </>
    ),
    archive: (
      <>
        <rect height="5" rx="1" width="20" x="2" y="3" />
        <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h15" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    arrowUpRight: (
      <>
        <path d="M5 19 19 5" />
        <path d="M8 5h11v11" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
        <path d="M4 5.5v16" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    close: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
    copy: (
      <>
        <rect height="13" rx="2" width="13" x="9" y="9" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
      </>
    ),
    delete: (
      <>
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </>
    ),
    edit: (
      <>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </>
    ),
    file: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </>
    ),
    folder: (
      <>
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      </>
    ),
    lock: (
      <>
        <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    network: (
      <>
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="m8.3 10.8 7.4-3.6M8.3 13.2l7.4 3.6" />
      </>
    ),
    pause: (
      <>
        <rect height="16" rx="1" width="4" x="6" y="4" />
        <rect height="16" rx="1" width="4" x="14" y="4" />
      </>
    ),
    pdf: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M10 12h4M10 16h4" />
      </>
    ),
    refresh: (
      <>
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16M16 16h5v5" />
      </>
    ),
    replay: (
      <>
        <path d="m4 12 4-4m-4 4 4 4m-4-4h11a5 5 0 0 1 5 5v1" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="11" cy="18" r="2" />
      </>
    ),
    sort: (
      <>
        <path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5z" />
        <path d="m19 3 .5 2.5L22 6l-2.5.5L19 9l-.5-2.5L16 6l2.5-.5z" />
      </>
    ),
    tree: (
      <>
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="12" r="3" />
        <path d="M6 9v6M9 6h3a3 3 0 0 1 3 3v3" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
      </>
    ),
    verified: (
      <>
        <path d="M12 3 14 5.2l3-.2.9 2.9 2.4 1.8-1.2 2.7.6 2.9-2.8 1.2-1.2 2.7-3-.6L12 21l-2.7-2.4-3 .6-1.2-2.7-2.8-1.2.6-2.9-1.2-2.7 2.4-1.8.9-2.9 3 .2z" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      >
        {paths[name]}
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      <span>GroundQ</span>
    </Link>
  );
}

const navItems = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#workflow' },
  { label: 'Features', href: '#features' },
  { label: 'Validation', href: '#validation' },
  { label: 'Question Bank', href: '#question-bank' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Logo />
        <nav
          aria-label="Primary navigation"
          className={open ? 'main-nav is-open' : 'main-nav'}
        >
          {navItems.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <Link className="header-signin" to="/sign-in">
            Sign in
          </Link>
          <Link className="button button-primary button-small" to="/sign-in">
            Get started <Icon name="arrowUpRight" size={15} />
          </Link>
        </div>
        <button
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="menu-button"
          onClick={() => setOpen(!open)}
          type="button"
        >
          <Icon name={open ? 'close' : 'menu'} />
        </button>
      </div>
    </header>
  );
}

export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow">
      <span className="eyebrow-line" />
      {children}
    </div>
  );
}

export function PortalHeader() {
  return (
    <header className="portal-header">
      <div className="portal-brand-lockup">
        <Logo />
      </div>
      <nav aria-label="Research portal navigation" className="portal-nav">
        <a href="/">Overview</a>
        <a href="#documentation">Documentation</a>
        <Link to="/">Return to Home</Link>
      </nav>
      <span aria-hidden="true" className="portal-account-mark">
        <span />
      </span>
    </header>
  );
}

export function PortalFooter() {
  return (
    <footer className="portal-footer">
      <span>
        © 2025 GroundQ Academic Systems. Precision Grounded Reasoning.
      </span>
      <span className="portal-status">
        ◉ SOURCE 100% Academic Grounding Verified
      </span>
      <div>
        <a href="#legal">Intellectual Privacy</a>
        <a href="#terms">Terms of Inquiry</a>
        <a href="#logs">Peer Audit Logs</a>
      </div>
    </footer>
  );
}

export function GoogleButton({
  disabled = false,
  onClick,
}: {
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className="portal-google"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="google-symbol">G</span>
      Continue with Google Workspace
    </button>
  );
}

export function PortalDivider() {
  return (
    <div className="portal-divider">
      <span />
      OR CONTINUE WITH EMAIL
      <span />
    </div>
  );
}

export function PortalField({
  action,
  id,
  label,
  placeholder,
  type = 'text',
  inputProps,
}: {
  action?: string;
  id: string;
  label: string;
  placeholder: string;
  type?: string;
  inputProps?: Omit<ComponentProps<'input'>, 'id' | 'placeholder' | 'type'>;
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const inputType = type === 'password' && isPasswordVisible ? 'text' : type;

  return (
    <label className="portal-field" htmlFor={id}>
      <span>
        {label}
        {action && (
          <a href={action === 'Forgot password?' ? '/password-recovery' : '#'}>
            {action}
          </a>
        )}
      </span>
      <input
        id={id}
        placeholder={placeholder}
        type={inputType}
        {...inputProps}
      />
      {type === 'password' && (
        <button
          aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
          className="field-eye"
          onClick={() => setIsPasswordVisible((visible) => !visible)}
          type="button"
        >
          {isPasswordVisible ? '◉' : '○'}
        </button>
      )}
    </label>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-page">
      <PortalHeader />
      <main className="portal-main">{children}</main>
      <PortalFooter />
    </div>
  );
}
