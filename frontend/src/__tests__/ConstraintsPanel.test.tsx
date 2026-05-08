import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConstraintsPanel } from '../components/ConstraintsPanel';
import { TripProvider } from '../context/TripContext';

function renderWithProvider(ui: React.ReactElement) {
    return render(<TripProvider>{ui}</TripProvider>);
}

describe('ConstraintsPanel', () => {
    it('renders the toggle button', () => {
        renderWithProvider(<ConstraintsPanel />);
        expect(screen.getByRole('button', { name: /preferences/i })).toBeInTheDocument();
    });

    it('panel is collapsed by default (controls region not visible)', () => {
        renderWithProvider(<ConstraintsPanel />);
        expect(screen.queryByRole('group', { name: /trip preferences/i })).not.toBeInTheDocument();
    });

    it('expands when toggle button is clicked', () => {
        renderWithProvider(<ConstraintsPanel />);
        const toggle = screen.getByRole('button', { name: /preferences/i });
        fireEvent.click(toggle);
        expect(screen.getByRole('group', { name: /trip preferences/i })).toBeInTheDocument();
    });

    it('toggle button has aria-expanded=false initially', () => {
        renderWithProvider(<ConstraintsPanel />);
        const toggle = screen.getByRole('button', { name: /preferences/i });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('toggle button has aria-expanded=true after click', () => {
        renderWithProvider(<ConstraintsPanel />);
        const toggle = screen.getByRole('button', { name: /preferences/i });
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    it('shows duration slider when expanded', () => {
        renderWithProvider(<ConstraintsPanel />);
        fireEvent.click(screen.getByRole('button', { name: /preferences/i }));
        const slider = screen.getByRole('slider', { name: /trip duration/i });
        expect(slider).toBeInTheDocument();
        expect(slider).toHaveAttribute('min', '1');
        expect(slider).toHaveAttribute('max', '14');
    });

    it('shows group type buttons when expanded', () => {
        renderWithProvider(<ConstraintsPanel />);
        fireEvent.click(screen.getByRole('button', { name: /preferences/i }));
        expect(screen.getByRole('button', { name: /group type: solo/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /group type: couple/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /group type: family/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /group type: group/i })).toBeInTheDocument();
    });

    it('shows pace buttons when expanded', () => {
        renderWithProvider(<ConstraintsPanel />);
        fireEvent.click(screen.getByRole('button', { name: /preferences/i }));
        expect(screen.getByRole('button', { name: /trip pace: relaxed/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /trip pace: balanced/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /trip pace: packed/i })).toBeInTheDocument();
    });

    it('shows wheelchair checkbox when expanded', () => {
        renderWithProvider(<ConstraintsPanel />);
        fireEvent.click(screen.getByRole('button', { name: /preferences/i }));
        expect(screen.getByRole('checkbox', { name: /wheelchair/i })).toBeInTheDocument();
    });

    it('Solo pill is marked as pressed by default', () => {
        renderWithProvider(<ConstraintsPanel />);
        fireEvent.click(screen.getByRole('button', { name: /preferences/i }));
        const soloBtn = screen.getByRole('button', { name: /group type: solo/i });
        expect(soloBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('clicking Couple sets its pill to pressed', () => {
        renderWithProvider(<ConstraintsPanel />);
        fireEvent.click(screen.getByRole('button', { name: /preferences/i }));
        const coupleBtn = screen.getByRole('button', { name: /group type: couple/i });
        fireEvent.click(coupleBtn);
        expect(coupleBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('collapses when toggle is clicked a second time', () => {
        renderWithProvider(<ConstraintsPanel />);
        const toggle = screen.getByRole('button', { name: /preferences/i });
        fireEvent.click(toggle);
        fireEvent.click(toggle);
        expect(screen.queryByRole('group', { name: /trip preferences/i })).not.toBeInTheDocument();
    });
});
