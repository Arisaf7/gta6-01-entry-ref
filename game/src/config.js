// SOLMARA — every tuning number in one place: the city, the player, the
// cars, the wanted system and the missions. Nothing here draws or listens.

export const STEP = 1 / 60;
export const SAVE_KEY = 'solmara-save-v1';

// The city is a square of streets on a grid; blocks sit between the roads.
export const WORLD = {
  size: 3600,
  pitch: 450,
  road: 110,
  sidewalk: 26,
};

// Sun-soaked coastal palette: warm asphalt, sand, terracotta roofs.
export const COLORS = {
  grass: '#7fae5a',
  sand: '#e8d39a',
  sea: '#2f7fb8',
  road: '#3a3f4a',
  roadEdge: '#565d6b',
  sidewalk: '#b9b3a4',
  lane: '#e8d24a',
  crosswalk: '#e8e8e8',
  building: ['#c96f4a', '#d9a05b', '#e8c87e', '#7fb3a3', '#b56576', '#e07a5f', '#f2e3c6', '#8fb8d8'],
  roof: ['#a34d33', '#b57a3e', '#c9a85e', '#5d8a7a', '#8f4a5e', '#b85a40', '#d9c49a', '#6a97b5'],
  park: '#5d9b4a',
  tree: '#2f7a3d',
  palm: '#3f9e57',
  hideout: '#3f9e57',
};

export const PLAYER = {
  walkSpeed: 235,
  radius: 13,
  health: 100,
  punchRange: 38,
  punchDamage: 30,
  punchCooldown: 0.45,
  shootCooldown: 0.22,
  bulletSpeed: 780,
  bulletDamage: 34,
  regenDelay: 10,
  regenRate: 6,
};

// Top speed, acceleration, steering grip and toughness per vehicle type.
export const CAR_TYPES = {
  sedan: { top: 330, accel: 300, brake: 520, grip: 2.6, health: 100, length: 48, width: 24, color: '#4a7fb5' },
  taxi: { top: 310, accel: 280, brake: 500, grip: 2.6, health: 90, length: 48, width: 24, color: '#e8c832' },
  van: { top: 260, accel: 220, brake: 460, grip: 2.2, health: 140, length: 58, width: 26, color: '#8a8f98' },
  sport: { top: 430, accel: 420, brake: 560, grip: 3.1, health: 80, length: 46, width: 23, color: '#c23b4e' },
  police: { top: 380, accel: 380, brake: 560, grip: 3.0, health: 120, length: 48, width: 24, color: '#2f3a4d' },
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 42;

// Heat 0..100; one star per 20 heat. Crimes add heat, hiding sheds it.
export const WANTED = {
  maxStars: 5,
  heatPerStar: 20,
  stealHeat: 25,
  hitPedHeat: 30,
  killPedHeat: 40,
  shootCopHeat: 35,
  shotNoiseHeat: 2,
  shotNoiseRadius: 520,
  decayPerSecond: 1.4,
  hideoutDecay: 6,
  quietSeconds: 8,
  policePerStar: [0, 2, 3, 4, 5, 6],
  bustSeconds: 1.6,
};

// Five story jobs from fixer Mama Rosa, in order. A mission's steps are
// checked in order; each step is one of: goto, drive, follow, deliver,
// lose (wanted to zero), escape (reach the marker while wanted).
export const MISSIONS = [
  {
    id: 1,
    name: 'First Wheels',
    briefing: "Mama Rosa needs wheels. Steal any car on the street and bring it to Rosa's Garage — the green zone on the map.",
    reward: 150,
    steps: [
      { type: 'drive', x: 225, y: 225, radius: 90, text: 'Steal a car and drive it to Rosa\'s Garage' },
    ],
  },
  {
    id: 2,
    name: 'Package Run',
    briefing: 'A package is waiting at the docks, east side. Pick it up on foot, then deliver it to the Coral Hotel before the clock runs out.',
    reward: 300,
    steps: [
      { type: 'goto', x: 3375, y: 1575, radius: 70, text: 'Pick up the package at the docks' },
      { type: 'deliver', x: 1575, y: 675, radius: 80, time: 75, text: 'Deliver the package to the Coral Hotel' },
    ],
  },
  {
    id: 3,
    name: 'Tail Job',
    briefing: 'A courier in a blue sedan is moving something Rosa wants. Follow him — stay close enough to see him, far enough that he never spots you.',
    reward: 350,
    steps: [
      { type: 'follow', seconds: 22, minDist: 90, maxDist: 320, text: 'Tail the blue courier — not too close, not too far' },
    ],
  },
  {
    id: 4,
    name: 'Heat Wave',
    briefing: 'The Solmara PD is all over you. Lose the heat: break line of sight, stay out of trouble, and let the stars fade.',
    reward: 400,
    steps: [
      { type: 'lose', text: 'Lose the wanted level — lay low until the stars clear' },
    ],
  },
  {
    id: 5,
    name: 'The Big Score',
    briefing: 'Solmara Bank, noon, one shot. Grab the cash on foot, then run — the whole department will be on you. Get to the hideout alive.',
    reward: 1000,
    steps: [
      { type: 'goto', x: 2025, y: 1125, radius: 80, text: 'Get inside Solmara Bank and grab the cash' },
      { type: 'escape', x: 225, y: 225, radius: 110, text: 'Escape to Rosa\'s Garage with the cash' },
    ],
  },
];

export const HIDEOUT = { x: 225, y: 225, radius: 130 };
export const BANK = { x: 2025, y: 1125 };
export const DOCKS = { x: 3375, y: 1575 };
export const HOTEL = { x: 1575, y: 675 };
