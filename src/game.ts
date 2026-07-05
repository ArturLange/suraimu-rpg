import type { GameState, SkillId, PlayerState, EquipmentSlots } from './types';
import { SKILL_DEFINITIONS } from './data/skills';
import { GameLoop } from './core/GameLoop';
import { SaveSystem } from './core/SaveSystem';
import { events } from './core/EventBus';
import { SkillSystem, playerXpForLevel } from './systems/SkillSystem';
import { CombatSystem } from './systems/CombatSystem';
import { InventorySystem } from './systems/InventorySystem';
import { ExploreSystem } from './systems/ExploreSystem';

const GAME_VERSION = '1.0.0';
const AUTO_SAVE_TICKS = 200; // every ~50 seconds at 250ms ticks

export class Game {
  readonly state: GameState;
  private loop: GameLoop;
  private saveSystem: SaveSystem;

  readonly skillSystem: SkillSystem;
  readonly combatSystem: CombatSystem;
  readonly inventorySystem: InventorySystem;
  readonly exploreSystem: ExploreSystem;

  constructor() {
    this.saveSystem = new SaveSystem();
    this.skillSystem = new SkillSystem();
    this.combatSystem = new CombatSystem(this.skillSystem);
    this.inventorySystem = new InventorySystem();
    this.exploreSystem = new ExploreSystem(this.skillSystem, this.combatSystem);

    const saved = this.saveSystem.load();
    this.state = saved ?? this.createNewGameState();

    this.loop = new GameLoop(250);
    this.loop.addCallback((tick) => this.onTick(tick));
  }

  start(): void {
    this.loop.start();
    events.emit('game:start');
  }

  stop(): void {
    this.loop.stop();
    this.saveSystem.save(this.state);
  }

  save(): void {
    this.saveSystem.save(this.state);
  }

  resetSave(): void {
    this.saveSystem.deleteSave();
  }

  private onTick(tick: number): void {
    // Passive skill XP
    this.skillSystem.tickPassiveXp(this.state);

    // Exploration tick
    this.exploreSystem.tick(this.state);

    // HP/MP regen out of combat
    if (!this.state.combat.active) {
      const stats = this.skillSystem.computeStats(this.state);
      const s = this.state.combat;
      s.playerHp = Math.min(stats.maxHp, s.playerHp + stats.hpRegen / 4);
      s.playerMp = Math.min(stats.maxMp, s.playerMp + stats.mpRegen / 4);
    }

    // Combat tick
    if (this.state.combat.active) {
      this.combatSystem.tick(this.state);
    }

    // Check location unlocks every 10 ticks
    if (tick % 10 === 0) {
      this.exploreSystem.checkUnlocks(this.state);
    }

    // Auto-save
    if (tick % AUTO_SAVE_TICKS === 0) {
      this.saveSystem.save(this.state);
    }

    // Trim logs
    this.trimLogs();

    // Update play time
    this.state.player.totalPlayTime += 0.25; // 250ms per tick

    events.emit('game:tick', this.state);
  }

  private trimLogs(): void {
    const maxLog = this.state.settings.maxLogEntries;
    if (this.state.activityLog.length > maxLog) {
      this.state.activityLog.splice(maxLog);
    }
  }

  private createNewGameState(): GameState {
    const skills = this.skillSystem.createInitialSkills();

    const player: PlayerState = {
      name: 'Adventurer',
      level: 1,
      xp: 0,
      xpToNext: playerXpForLevel(1),
      gold: 0,
      hp: 100,
      mp: 50,
      skills,
      inventory: [
        { itemId: 'smallHealthPotion', quantity: 5 },
        { itemId: 'rustySword', quantity: 1 },
      ],
      equipment: {
        weapon: null,
        armor: null,
        helmet: null,
        boots: null,
        ring: null,
        amulet: null,
      } as EquipmentSlots,
      unlockedLocations: ['forestEdge'],
      totalPlayTime: 0,
      killCount: {},
    };

    const stats = this.skillSystem.computeStats({
      player,
      combat: { active: false } as any,
      explore: { exploring: false } as any,
      activityLog: [],
      settings: { tickRate: 250, autoSaveInterval: 200, maxLogEntries: 100, combatLogEntries: 50 },
      version: GAME_VERSION,
    });

    return {
      version: GAME_VERSION,
      player,
      combat: {
        active: false,
        currentMonster: null,
        monsterHp: 0,
        monsterMp: 0,
        playerHp: stats.maxHp,
        playerMp: stats.maxMp,
        ticksElapsed: 0,
        log: [],
        autoBattle: false,
        currentLocation: 'forestEdge',
      },
      explore: {
        currentLocation: 'forestEdge',
        exploring: false,
        explorationProgress: 0,
        explorationSpeed: 1,
      },
      activityLog: [
        {
          timestamp: Date.now(),
          message: '🌟 Welcome to Suraimu RPG! Your adventure begins...',
          type: 'system',
        },
      ],
      settings: {
        tickRate: 250,
        autoSaveInterval: 200,
        maxLogEntries: 100,
        combatLogEntries: 50,
      },
    };
  }

  // ============================================================
  // Public API
  // ============================================================

  getComputedStats() {
    return this.skillSystem.computeStats(this.state);
  }

  toggleSkill(skillId: SkillId): void {
    const skill = this.state.player.skills[skillId];
    if (!skill) return;

    const def = SKILL_DEFINITIONS.find((d) => d.id === skillId);
    if (!def) return;

    if (this.state.player.level < def.unlockLevel) return;

    skill.active = !skill.active;
    events.emit('skill:toggle', { skillId, active: skill.active });
  }

  startCombat(locationId: string): void {
    this.combatSystem.startCombat(this.state, locationId);
    this.state.explore.exploring = false;
  }

  stopCombat(): void {
    this.combatSystem.stopCombat(this.state);
  }

  toggleAutoBattle(): void {
    this.state.combat.autoBattle = !this.state.combat.autoBattle;
    events.emit('combat:autoBattleToggle', { enabled: this.state.combat.autoBattle });
  }

  setLocation(locationId: string): boolean {
    return this.exploreSystem.setLocation(this.state, locationId);
  }

  toggleExploring(): void {
    if (this.state.explore.exploring) {
      this.exploreSystem.stopExploring(this.state);
    } else {
      this.exploreSystem.startExploring(this.state);
    }
  }

  useItem(itemId: string): boolean {
    return this.inventorySystem.useItem(this.state, itemId);
  }

  equipItem(itemId: string): boolean {
    return this.inventorySystem.equipItem(this.state, itemId);
  }

  sellItem(itemId: string, qty: number = 1): number {
    return this.inventorySystem.sellItem(this.state, itemId, qty);
  }
}
