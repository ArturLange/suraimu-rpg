// ============================================================
// Core Types
// ============================================================

export type SkillId =
  | 'breathing'
  | 'running'
  | 'swordFighting'
  | 'fireMagic'
  | 'waterMagic'
  | 'windMagic'
  | 'earthMagic'
  | 'lightningMagic'
  | 'darkMagic'
  | 'divineMagic'
  | 'spatialMagic'
  | 'poisonMagic'
  | 'bodyEnhancement'
  | 'stealth'
  | 'herbalism'
  | 'crafting';

export type SkillCategory = 'physical' | 'magic' | 'survival' | 'crafting';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  category: SkillCategory;
  maxLevel: number;
  /** XP required per level = base * level^exponent */
  xpBase: number;
  xpExponent: number;
  /** Effects this skill provides per level */
  effectsPerLevel: Partial<StatModifiers>;
  /** Unlocks at this player level */
  unlockLevel: number;
  icon: string;
}

export interface SkillState {
  id: SkillId;
  level: number;
  xp: number;
  xpToNext: number;
  active: boolean;
}

// ============================================================
// Stats
// ============================================================

export interface StatModifiers {
  maxHp: number;
  maxMp: number;
  hpRegen: number;
  mpRegen: number;
  physicalAttack: number;
  magicAttack: number;
  physicalDefense: number;
  magicDefense: number;
  speed: number;
  critChance: number;
  dodgeChance: number;
  explorationSpeed: number;
}

export interface PlayerStats {
  maxHp: number;
  maxMp: number;
  hpRegen: number;
  mpRegen: number;
  physicalAttack: number;
  magicAttack: number;
  physicalDefense: number;
  magicDefense: number;
  speed: number;
  critChance: number;
  dodgeChance: number;
  explorationSpeed: number;
}

// ============================================================
// Combat
// ============================================================

export type DamageType = 'physical' | 'fire' | 'water' | 'wind' | 'earth' | 'lightning' | 'dark' | 'divine' | 'spatial' | 'poison';

export interface MonsterAbility {
  name: string;
  description: string;
  damageType: DamageType;
  powerMultiplier: number;
  mpCost: number;
  cooldownTicks: number;
  currentCooldown: number;
}

export type MonsterRank = 'H' | 'G' | 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS';

export interface MonsterDefinition {
  id: string;
  name: string;
  description: string;
  rank: MonsterRank;
  tier: number;
  hp: number;
  mp: number;
  physicalAttack: number;
  magicAttack: number;
  physicalDefense: number;
  magicDefense: number;
  speed: number;
  abilities: MonsterAbility[];
  dropTable: DropEntry[];
  xpReward: number;
  goldReward: [number, number]; // min, max
  isBoss: boolean;
  element?: DamageType;
  icon: string;
}

export interface DropEntry {
  itemId: string;
  chance: number; // 0-1
  minQty: number;
  maxQty: number;
}

export interface CombatState {
  active: boolean;
  currentMonster: MonsterDefinition | null;
  monsterHp: number;
  monsterMp: number;
  playerHp: number;
  playerMp: number;
  ticksElapsed: number;
  log: CombatLogEntry[];
  autoBattle: boolean;
  currentLocation: string;
}

export interface CombatLogEntry {
  tick: number;
  message: string;
  type: 'damage' | 'heal' | 'info' | 'loot' | 'death' | 'victory';
}

// ============================================================
// Items & Inventory
// ============================================================

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'material' | 'quest';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: ItemRarity;
  tier: number;
  icon: string;
  stackable: boolean;
  maxStack: number;
  statBonuses?: Partial<StatModifiers>;
  skillXpBonus?: Partial<Record<SkillId, number>>; // multiplier bonus for skill xp
  onUse?: string; // action ID when used
  sellValue: number;
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
}

export interface EquipmentSlots {
  weapon: string | null;
  armor: string | null;
  helmet: string | null;
  boots: string | null;
  ring: string | null;
  amulet: string | null;
}

// ============================================================
// Locations & Exploration
// ============================================================

export interface LocationDefinition {
  id: string;
  name: string;
  description: string;
  tier: number;
  unlockRequirement?: {
    playerLevel?: number;
    skills?: Partial<Record<SkillId, number>>;
    questComplete?: string;
  };
  monsters: string[]; // monster IDs
  bossId?: string;
  bossSpawnChance: number; // 0-1 per exploration
  backgroundClass: string;
}

export interface ExploreState {
  currentLocation: string;
  exploring: boolean;
  explorationProgress: number; // 0-100
  explorationSpeed: number; // ticks per point
}

// ============================================================
// Player
// ============================================================

export interface PlayerState {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  hp: number;
  mp: number;
  skills: Record<SkillId, SkillState>;
  inventory: InventorySlot[];
  equipment: EquipmentSlots;
  unlockedLocations: string[];
  totalPlayTime: number; // seconds
  killCount: Record<string, number>;
}

// ============================================================
// Game State
// ============================================================

export interface GameState {
  player: PlayerState;
  combat: CombatState;
  explore: ExploreState;
  activityLog: ActivityLogEntry[];
  settings: GameSettings;
  version: string;
}

export interface ActivityLogEntry {
  timestamp: number;
  message: string;
  type: 'skill' | 'combat' | 'loot' | 'level' | 'explore' | 'system';
}

export interface GameSettings {
  tickRate: number; // ms per tick
  autoSaveInterval: number; // ticks between auto-saves
  maxLogEntries: number;
  combatLogEntries: number;
}
