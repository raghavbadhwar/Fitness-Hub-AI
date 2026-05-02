import * as crypto from "expo-crypto";

export function generateId(): string {
  return crypto.randomUUID();
}
