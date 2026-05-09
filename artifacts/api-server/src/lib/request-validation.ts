import type { Response } from "express";

export function readObjectBody(
  body: unknown,
  res: Response,
  message = "Request body must be an object",
): Record<string, unknown> | null {
  if (body === undefined || body === null) {
    return {};
  }

  if (typeof body !== "object" || Array.isArray(body)) {
    res.status(400).json({ error: message });
    return null;
  }

  return body as Record<string, unknown>;
}
