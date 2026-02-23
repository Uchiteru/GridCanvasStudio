import { expect, test, describe } from 'vitest';
import { snap, genId, GRID_SIZE } from './utils';

describe('Utils', () => {
    test('snap should round to nearest multiple of GRID_SIZE', () => {
        expect(snap(0)).toBe(0);
        expect(snap(19)).toBe(0);
        expect(snap(20)).toBe(GRID_SIZE);
        expect(snap(GRID_SIZE + 5)).toBe(GRID_SIZE);
        expect(snap(GRID_SIZE + 21)).toBe(GRID_SIZE * 2);
    });

    test('genId should return unique ids with correct prefix', () => {
        const id1 = genId('test');
        const id2 = genId('test');
        expect(id1).toMatch(/^test-\d+$/);
        expect(id2).toMatch(/^test-\d+$/);
        expect(id1).not.toBe(id2);
    });
});
