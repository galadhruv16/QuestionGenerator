import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app/App';
describe('GroundQ scaffold', () => {
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
});
