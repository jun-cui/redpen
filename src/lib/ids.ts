const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
// Largest multiple of 36 below 256: bytes at or above it are skipped to avoid modulo bias.
const UNBIASED_LIMIT = 252

/**
 * A random (version 4) UUID. Unlike crypto.randomUUID() this also works outside secure
 * contexts, such as a dev server opened on a phone over the local network.
 */
export function newUuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Whether `value` is a UUID in its canonical form, as the database returns them. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

/** A key point id, unique within a card: "kp_" + 8 random base-36 characters. */
export function newKeyPointId(): string {
  let id = 'kp_'
  while (id.length < 11) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte >= UNBIASED_LIMIT) continue
      id += ALPHABET.charAt(byte % 36)
      if (id.length === 11) break
    }
  }
  return id
}
