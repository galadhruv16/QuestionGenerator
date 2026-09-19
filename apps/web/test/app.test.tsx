import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app/App';
describe('GroundQ scaffold', () => {
  it('renders the temporary application shell', () => {
    render(<App />);
    expect(screen.getByText('GroundQ')).toBeInTheDocument();
    expect(screen.getByText('Scaffold initialized.')).toBeInTheDocument();
  });
});
