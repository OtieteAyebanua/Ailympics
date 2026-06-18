/**
 * Minimal writable store — a tiny framework-agnostic replacement for
 * `svelte/store`'s `writable`, so the ported director/stores keep working in
 * React. React components subscribe via `useStore` (useSyncExternalStore).
 */
export interface Writable<T> {
  subscribe(run: (value: T) => void): () => void;
  set(value: T): void;
  update(fn: (value: T) => T): void;
  get(): T;
}

export function writable<T>(initial: T): Writable<T> {
  let value = initial;
  const subscribers = new Set<(value: T) => void>();
  return {
    subscribe(run) {
      run(value);
      subscribers.add(run);
      return () => subscribers.delete(run);
    },
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const run of subscribers) run(value);
    },
    update(fn) {
      this.set(fn(value));
    },
    get() {
      return value;
    },
  };
}
