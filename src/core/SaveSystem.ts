import type { GameState } from '../types';
import { events } from './EventBus';

const SAVE_KEY = 'suraimu_rpg_save';
const SAVE_VERSION = '1.0.0';

export class SaveSystem {
  save(state: GameState): void {
    try {
      const data = JSON.stringify({ ...state, version: SAVE_VERSION });
      localStorage.setItem(SAVE_KEY, data);
      events.emit('save:success');
    } catch (e) {
      console.error('Failed to save game:', e);
      events.emit('save:error', e);
    }
  }

  load(): GameState | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as GameState;
      if (!this.isValidSave(parsed)) {
        console.warn('Save file version mismatch or invalid data. Starting fresh.');
        return null;
      }
      return parsed;
    } catch (e) {
      console.error('Failed to load save:', e);
      return null;
    }
  }

  deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
    events.emit('save:deleted');
  }

  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  private isValidSave(data: unknown): data is GameState {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    return (
      typeof d['version'] === 'string' &&
      typeof d['player'] === 'object' &&
      typeof d['combat'] === 'object'
    );
  }
}
