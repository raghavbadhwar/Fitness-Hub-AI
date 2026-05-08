import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { setRequestLogContext } from "../lib/logger.ts";

export const requireApiAuth: RequestHandler = (req, res, next) => {
  try {
    const userId = getAuth(req)?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    setRequestLogContext(res, { userId });
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};
