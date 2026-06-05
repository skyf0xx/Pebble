import { createAvatar } from "@dicebear/core";
import * as thumbs from "@dicebear/thumbs";

export function makeAvatar(seed: string, overrides?: Record<string, unknown>): string {
  return createAvatar(thumbs, {
    eyesColor: ["1e1e2e"],
    mouthColor: ["1e1e2e"],
    ...overrides,
    seed,
  }).toDataUri();
}

export const avatars = {
  pebble:      makeAvatar("Pebble",       { eyes: ["variant6W12"], mouth: ["variant4"], backgroundColor: ["f2f3fd"], shapeColor: ["3B82F6"], eyesColor: ["1e1e2e"], mouthColor: ["F97316"] }),
  connecting:  makeAvatar("Connecting",   { backgroundColor: ["dbeafe"], shapeColor: ["3B82F6"] }),
  error:       makeAvatar("Disconnected", { backgroundColor: ["fee2e2"], shapeColor: ["ef4444"] }),
  locked:      makeAvatar("Locked",       { backgroundColor: ["fef3c7"], shapeColor: ["F97316"] }),
} as const;
