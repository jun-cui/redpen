/** The part of the Web Storage API the demo store uses. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, String(value))
    },
    removeItem: (key) => {
      items.delete(key)
    },
  }
}

/** The browser's localStorage, or null where it is missing or blocked (private mode, tests). */
export function browserStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage
    if (!storage) return null
    const probe = '__redpen_probe__'
    storage.setItem(probe, probe)
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}
