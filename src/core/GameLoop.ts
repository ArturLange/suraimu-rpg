import { events } from './EventBus';

type TickCallback = (tick: number) => void;

export class GameLoop {
  private tick = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callbacks: TickCallback[] = [];
  private tickRate: number;
  private running = false;

  constructor(tickRate = 250) {
    this.tickRate = tickRate;
  }

  addCallback(cb: TickCallback): void {
    this.callbacks.push(cb);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.intervalId = setInterval(() => this.step(), this.tickRate);
    events.emit('gameLoop:start');
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    events.emit('gameLoop:stop');
  }

  private step(): void {
    this.tick++;
    for (const cb of this.callbacks) {
      cb(this.tick);
    }
    events.emit('tick', this.tick);
  }

  get currentTick(): number {
    return this.tick;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
