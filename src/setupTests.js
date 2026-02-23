import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock matchMedia
window.matchMedia = window.matchMedia || function () {
    return {
        matches: false,
        addListener: function () { },
        removeListener: function () { }
    };
};

// Mock Tauri Core APIs
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

// Mock Tauri Plugin Dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
    save: vi.fn(),
    open: vi.fn(),
}));

// Mock Tauri Plugin FS
vi.mock('@tauri-apps/plugin-fs', () => ({
    writeFile: vi.fn(),
    readFile: vi.fn(),
    mkdir: vi.fn(),
    exists: vi.fn(),
    readDir: vi.fn(),
}));
