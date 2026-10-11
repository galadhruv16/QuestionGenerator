import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/app/App';

describe('GroundQ scaffold', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('renders the GroundQ landing page', () => {
    render(<App />);
    expect(screen.getAllByText('GroundQ').length).toBeGreaterThan(0);
    expect(screen.getByText('Grounded knowledge.')).toBeInTheDocument();
    expect(screen.getByText('Better questions.')).toBeInTheDocument();
  });

  it('keeps the Stitch authentication entry points in the app shell', () => {
    render(<App />);
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute(
      'href',
      '/sign-in',
    );
    expect(
      screen.getAllByRole('link', { name: 'Get started' })[0],
    ).toHaveAttribute('href', '/sign-in');
  });

  it('renders the password update route used by recovery links', () => {
    window.history.pushState({}, '', '/update-password');
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Choose a new password' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Show password' }),
    ).toHaveLength(2);
  });
});
