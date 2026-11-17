// SOLMARA — the city itself: a street grid with blocks, buildings, a beach,
// docks, a park and Rosa's Garage. It also answers the questions the rest of
// the game asks: is this point on a road, what is the nearest street, and
// does this circle hit a building.

import { WORLD, COLORS, HIDEOUT, BANK, DOCKS, HOTEL } from './config.js';
import { pick, range } from './random.js';

export const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

export function createCity(random) {
  const centers = [];
  for (let value = 0; value <= WORLD.size; value += WORLD.pitch) centers.push(value);
  const last = WORLD.size;
  const roadHalf = WORLD.road / 2;
  const beachTop = last - WORLD.pitch + roadHalf + 10;
  const seaTop = last - 60;

  const buildings = [];
  const trees = [];
  const blocks = [];

  // Blocks sit between the streets. The south row is the beach, the east
  // column is the docks, one block is the park, one is Rosa's Garage.
  for (let gx = 0; gx < centers.length - 1; gx += 1) {
    for (let gy = 0; gy < centers.length - 1; gy += 1) {
      const x0 = centers[gx] + roadHalf + 8;
      const y0 = centers[gy] + roadHalf + 8;
      const x1 = centers[gx + 1] - roadHalf - 8;
      const y1 = centers[gy + 1] - roadHalf - 8;
      const block = { gx, gy, x0, y0, x1, y1 };
      blocks.push(block);
      if (gy === centers.length - 2) continue; // beach row
      if (gx === centers.length - 2) continue; // docks column
      if (gx === 3 && gy === 3) {
        for (let i = 0; i < 14; i += 1) {
          trees.push({ x: range(random, x0 + 20, x1 - 20), y: range(random, y0 + 20, y1 - 20), r: range(random, 12, 20) });
        }
        continue; // park
      }
      if (gx === 0 && gy === 0) {
        buildings.push({ x: x0 + 60, y: y0 + 60, w: 120, h: 90, color: '#5d8a7a', roof: '#3f6b5e', label: "Rosa's" });
        continue; // hideout block
      }
      const color = pick(random, COLORS.building);
      const roof = pick(random, COLORS.roof);
      if (random() < 0.45) {
        buildings.push({ x: x0 + 20, y: y0 + 20, w: x1 - x0 - 40, h: y1 - y0 - 40, color, roof, label: null });
      } else {
        const vertical = random() < 0.5;
        if (vertical) {
          const split = (x0 + x1) / 2;
          buildings.push({ x: x0 + 14, y: y0 + 14, w: split - x0 - 28, h: y1 - y0 - 28, color, roof, label: null });
          buildings.push({ x: split + 14, y: y0 + 14, w: x1 - split - 28, h: y1 - y0 - 28, color: pick(random, COLORS.building), roof: pick(random, COLORS.roof), label: null });
        } else {
          const split = (y0 + y1) / 2;
          buildings.push({ x: x0 + 14, y: y0 + 14, w: x1 - x0 - 28, h: split - y0 - 28, color, roof, label: null });
          buildings.push({ x: x0 + 14, y: split + 14, w: x1 - x0 - 28, h: y1 - split - 28, color: pick(random, COLORS.building), roof: pick(random, COLORS.roof), label: null });
        }
      }
    }
  }

  // Landmark buildings: the bank and the hotel get fixed spots and labels.
  buildings.push({ x: BANK.x - 70, y: BANK.y - 55, w: 140, h: 110, color: '#e8e0c8', roof: '#b8a888', label: 'BANK' });
  buildings.push({ x: HOTEL.x - 80, y: HOTEL.y - 60, w: 160, h: 120, color: '#e07a5f', roof: '#b85a40', label: 'HOTEL' });

  function nearestCenter(value) {
    let best = centers[0];
    let bestDist = Math.abs(value - best);
    for (const center of centers) {
      const dist = Math.abs(value - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = center;
      }
    }
    return best;
  }

  function isOnRoad(x, y) {
    const dx = Math.abs(x - nearestCenter(x));
    const dy = Math.abs(y - nearestCenter(y));
    return dx < roadHalf || dy < roadHalf;
  }

  function isOnSidewalk(x, y) {
    const dx = Math.abs(x - nearestCenter(x));
    const dy = Math.abs(y - nearestCenter(y));
    const band = roadHalf + WORLD.sidewalk;
    return (dx < band || dy < band) && !isOnRoad(x, y);
  }

  function inSea(x, y) {
    return y > seaTop;
  }

  function buildingAt(x, y) {
    for (const building of buildings) {
      if (x >= building.x && x <= building.x + building.w && y >= building.y && y <= building.y + building.h) return building;
    }
    return null;
  }

  // Push a circle out of buildings, the sea and the world edge; returns the
  // corrected position and whether anything was hit.
  function collideCircle(x, y, radius) {
    let hit = false;
    let nx = Math.max(radius, Math.min(WORLD.size - radius, x));
    let ny = Math.max(radius, Math.min(seaTop - radius, y));
    if (nx !== x || ny !== y) hit = true;
    for (const building of buildings) {
      const cx = Math.max(building.x, Math.min(nx, building.x + building.w));
      const cy = Math.max(building.y, Math.min(ny, building.y + building.h));
      const dx = nx - cx;
      const dy = ny - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq >= radius * radius) continue;
      hit = true;
      if (distSq === 0) {
        ny = building.y - radius;
        continue;
      }
      const dist = Math.sqrt(distSq);
      nx = cx + (dx / dist) * radius;
      ny = cy + (dy / dist) * radius;
    }
    return { x: nx, y: ny, hit };
  }

  function randomRoadPoint(randomFn, avoidX = null, avoidY = null, minDist = 0) {
    for (let tries = 0; tries < 40; tries += 1) {
      const horizontal = randomFn() < 0.5;
      const street = pick(randomFn, centers);
      const along = range(randomFn, 120, WORLD.size - 120);
      const point = horizontal ? { x: along, y: street } : { x: street, y: along };
      if (point.y > beachTop) continue;
      if (avoidX !== null && Math.hypot(point.x - avoidX, point.y - avoidY) < minDist) continue;
      return point;
    }
    return { x: WORLD.pitch, y: WORLD.pitch };
  }

  function randomSidewalkPoint(randomFn) {
    for (let tries = 0; tries < 40; tries += 1) {
      const horizontal = randomFn() < 0.5;
      const street = pick(randomFn, centers);
      const along = range(randomFn, 120, WORLD.size - 120);
      const side = randomFn() < 0.5 ? 1 : -1;
      const offset = roadHalf + WORLD.sidewalk / 2;
      const point = horizontal ? { x: along, y: street + side * offset } : { x: street + side * offset, y: along };
      if (point.y > beachTop || point.x > WORLD.size - 80) continue;
      return point;
    }
    return { x: WORLD.pitch, y: WORLD.pitch + roadHalf + 13 };
  }

  return {
    centers, buildings, trees, blocks, beachTop, seaTop,
    hideout: HIDEOUT, bank: BANK, docks: DOCKS, hotel: HOTEL,
    isOnRoad, isOnSidewalk, inSea, buildingAt, collideCircle,
    randomRoadPoint, randomSidewalkPoint, nearestCenter,
  };
}
