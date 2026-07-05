import type { LocationDefinition } from '../types';

export const LOCATION_DEFINITIONS: LocationDefinition[] = [
  {
    id: 'forestEdge',
    name: 'Forest Edge',
    description:
      'The outskirts of the Great Jura Forest. Monsters here are weak, but the forest holds untold secrets.',
    tier: 1,
    backgroundClass: 'bg-forest',
    monsters: ['slime', 'goblin', 'wolf', 'giantBat'],
    bossSpawnChance: 0,
  },
  {
    id: 'forestDepths',
    name: 'Forest Depths',
    description:
      'Deeper into the Great Jura Forest. Monsters grow stronger here, and the air hums with magic.',
    tier: 2,
    unlockRequirement: { playerLevel: 5 },
    backgroundClass: 'bg-deep-forest',
    monsters: ['hobgoblin', 'direWolf', 'orc'],
    bossSpawnChance: 0.05,
  },
  {
    id: 'orcDen',
    name: "Orc's Den",
    description: 'A cave complex that serves as home to a large orc tribe. Dangerous and heavily guarded.',
    tier: 3,
    unlockRequirement: { playerLevel: 10, skills: { swordFighting: 5 } },
    backgroundClass: 'bg-cave',
    monsters: ['orc', 'troll', 'lizardman'],
    bossSpawnChance: 0.08,
  },
  {
    id: 'serpentMarsh',
    name: 'Serpent Marsh',
    description:
      'A fog-laden marsh teeming with venomous creatures. Adventurers who venture here rarely return unchanged.',
    tier: 3,
    unlockRequirement: { playerLevel: 12 },
    backgroundClass: 'bg-marsh',
    monsters: ['blackSerpent', 'lizardman', 'troll'],
    bossSpawnChance: 0.06,
  },
  {
    id: 'ogreTerritory',
    name: 'Ogre Territory',
    description:
      'The territory of a powerful ogre clan. They are said to possess the seeds of divinity.',
    tier: 4,
    unlockRequirement: { playerLevel: 20, skills: { swordFighting: 15 } },
    backgroundClass: 'bg-highland',
    monsters: ['ogre', 'highOrc', 'salamander'],
    bossSpawnChance: 0.1,
  },
  {
    id: 'volcanoCaldera',
    name: 'Volcano Caldera',
    description:
      'A volcanic region where fire-aligned monsters roam. The heat here is intense, but the materials are valuable.',
    tier: 4,
    unlockRequirement: { playerLevel: 22, skills: { fireMagic: 10 } },
    backgroundClass: 'bg-volcano',
    monsters: ['salamander', 'ogre'],
    bossSpawnChance: 0.12,
  },
  {
    id: 'demonRealm',
    name: 'Demon Realm Rift',
    description:
      'A rift that connects to the Demon Realm. The boundary between worlds is thin here.',
    tier: 5,
    unlockRequirement: { playerLevel: 35, skills: { darkMagic: 5 } },
    backgroundClass: 'bg-demon',
    monsters: ['lesserDemon', 'elementalSpirit'],
    bossSpawnChance: 0.1,
  },
  {
    id: 'spiritForest',
    name: 'Ancient Spirit Forest',
    description:
      'A mystical forest where ancient spirits reside. Time flows differently here.',
    tier: 6,
    unlockRequirement: {
      playerLevel: 50,
      skills: { divineMagic: 10, spatialMagic: 5 },
    },
    backgroundClass: 'bg-spirit',
    monsters: ['greaterSpirit'],
    bossSpawnChance: 0.15,
  },
  {
    id: 'demonsGate',
    name: "Demon Lord's Gate",
    description:
      'The fortified entrance to the domain of a Demon Lord. Only the strongest can survive here.',
    tier: 7,
    unlockRequirement: {
      playerLevel: 65,
      skills: { darkMagic: 20 },
    },
    backgroundClass: 'bg-dark-castle',
    monsters: ['highDemon'],
    bossSpawnChance: 0.2,
  },
  {
    id: 'dragonMountain',
    name: 'Dragon Peak',
    description:
      'The dwelling place of disaster-class dragons. A single roar can be heard for miles.',
    tier: 8,
    unlockRequirement: {
      playerLevel: 80,
      skills: { swordFighting: 50, fireMagic: 30 },
    },
    backgroundClass: 'bg-dragon',
    monsters: ['disasterDragon'],
    bossSpawnChance: 0.25,
  },
  {
    id: 'phoenixNest',
    name: 'Phoenix Sanctuary',
    description:
      "The sacred nest of a calamity-class phoenix. The air itself burns with divine fire. The world's adventurers have gathered to witness it.",
    tier: 9,
    unlockRequirement: {
      playerLevel: 95,
      skills: { fireMagic: 50, divineMagic: 40 },
    },
    backgroundClass: 'bg-phoenix',
    monsters: ['calamityPhoenix'],
    bossId: 'calamityPhoenix',
    bossSpawnChance: 1.0,
  },
  {
    id: 'voidAbyss',
    name: 'The Void Abyss',
    description:
      'A place beyond comprehension. Reality itself breaks down here. Only true sovereigns dare to venture forth.',
    tier: 10,
    unlockRequirement: {
      playerLevel: 100,
      skills: {
        spatialMagic: 80,
        darkMagic: 80,
        divineMagic: 60,
      },
    },
    backgroundClass: 'bg-void',
    monsters: ['rimuruMimic'],
    bossId: 'rimuruMimic',
    bossSpawnChance: 1.0,
  },
];

export const LOCATION_MAP = new Map(LOCATION_DEFINITIONS.map((l) => [l.id, l]));
