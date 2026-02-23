import { describe, test, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';

// Mock matchMedia for jsdom
window.matchMedia = window.matchMedia || function () {
    return {
        matches: false,
        addListener: function () { },
        removeListener: function () { }
    };
};

describe('App', () => {
    test('renders without crashing', () => {
        // Basic test to see if the main component hierarchy mounts
        const { container } = render(<App />);
        expect(container).toBeTruthy();
    });
});
