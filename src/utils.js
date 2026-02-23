export const GRID_SIZE = 40;

export function snap(v) {
    return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

let nodeIdCounter = 10;
export function genId(type) {
    return `${type}-${++nodeIdCounter}`;
}
