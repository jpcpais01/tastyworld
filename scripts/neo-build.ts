import { buildNeo } from '../src/world/neo';
const t = performance.now();
const r = buildNeo();
const a = r.anchors;
console.log('built ms', (performance.now() - t) | 0, 'props', r.props.length, 'lamps', r.lamps.length, 'rooms', a.rooms.length, 'hotels', a.hotels.length, 'stalls', a.stalls.map((s) => s.id).join(' '));
console.log('graph', a.graph.nodes.length, a.graph.edges.length, 'heap MB', (process.memoryUsage().heapUsed / 1e6) | 0);
const kinds: Record<string, number> = {}; for (const rm of a.rooms) kinds[rm.kind] = (kinds[rm.kind] ?? 0) + 1; console.log(kinds);
console.log('door', a.hiddenDoor);
