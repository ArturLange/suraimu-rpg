type EventHandler<T = unknown> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler);
    return () => this.off(event, handler);
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    this.listeners.get(event)?.delete(handler as EventHandler);
  }

  emit<T>(event: string, data?: T): void {
    this.listeners.get(event)?.forEach((h) => h(data));
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const events = new EventBus();
