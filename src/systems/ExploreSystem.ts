import type { GameState } from '../types';
import { LOCATION_DEFINITIONS, LOCATION_MAP } from '../data/locations';
import { SkillSystem } from './SkillSystem';
import { CombatSystem } from './CombatSystem';
import { events } from '../core/EventBus';

export class ExploreSystem {
  private skillSystem: SkillSystem;
  private combatSystem: CombatSystem;

  constructor(skillSystem: SkillSystem, combatSystem: CombatSystem) {
    this.skillSystem = skillSystem;
    this.combatSystem = combatSystem;
  }

  /** Advance exploration each tick */
  tick(state: GameState): void {
    const explore = state.explore;
    if (!explore.exploring) return;

    const stats = this.skillSystem.computeStats(state);

    // Award running XP while exploring
    this.skillSystem.addSkillXp(state, 'running', 0.3 + stats.explorationSpeed * 0.05);

    // Advance progress
    const progressGain = (stats.explorationSpeed * 2) / 100;
    explore.explorationProgress = Math.min(100, explore.explorationProgress + progressGain);

    if (explore.explorationProgress >= 100) {
      explore.explorationProgress = 0;
      this.onExplorationComplete(state);
    }
  }

  private onExplorationComplete(state: GameState): void {
    const location = LOCATION_MAP.get(state.explore.currentLocation);
    if (!location) return;

    state.activityLog.unshift({
      timestamp: Date.now(),
      message: `🗺️ Explored ${location.name}.`,
      type: 'explore',
    });

    events.emit('explore:complete', { locationId: location.id });

    // Trigger combat encounter if not already in combat
    if (!state.combat.active) {
      state.combat.currentLocation = location.id;
      this.combatSystem.startNewEncounter(state);
    }
  }

  setLocation(state: GameState, locationId: string): boolean {
    const location = LOCATION_MAP.get(locationId);
    if (!location) return false;

    if (!state.player.unlockedLocations.includes(locationId)) {
      return false;
    }

    state.explore.currentLocation = locationId;
    state.explore.explorationProgress = 0;

    state.activityLog.unshift({
      timestamp: Date.now(),
      message: `📍 Moved to ${location.name}.`,
      type: 'explore',
    });

    events.emit('explore:locationChange', { locationId });
    return true;
  }

  startExploring(state: GameState): void {
    state.explore.exploring = true;
    events.emit('explore:start');
  }

  stopExploring(state: GameState): void {
    state.explore.exploring = false;
    events.emit('explore:stop');
  }

  /** Check if any new locations should be unlocked based on player state */
  checkUnlocks(state: GameState): void {
    const player = state.player;

    for (const loc of LOCATION_DEFINITIONS) {
      if (player.unlockedLocations.includes(loc.id)) continue;

      const req = loc.unlockRequirement;
      if (!req) {
        player.unlockedLocations.push(loc.id);
        continue;
      }

      let met = true;

      if (req.playerLevel && player.level < req.playerLevel) {
        met = false;
      }

      if (req.skills && met) {
        for (const [skillId, minLevel] of Object.entries(req.skills)) {
          const skillState = player.skills[skillId as keyof typeof player.skills];
          if (!skillState || skillState.level < minLevel) {
            met = false;
            break;
          }
        }
      }

      if (met) {
        player.unlockedLocations.push(loc.id);
        const message = `🗺️ New location unlocked: ${loc.name}!`;
        player.unlockedLocations.push(loc.id);
        state.activityLog.unshift({
          timestamp: Date.now(),
          message,
          type: 'explore',
        });
        events.emit('explore:unlock', { locationId: loc.id });
      }
    }

    // Deduplicate
    player.unlockedLocations = [...new Set(player.unlockedLocations)];
  }

  getAvailableLocations(state: GameState) {
    return LOCATION_DEFINITIONS.filter((loc) =>
      state.player.unlockedLocations.includes(loc.id)
    );
  }
}
