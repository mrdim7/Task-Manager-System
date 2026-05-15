import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth";

export interface AuthRequest extends Request {
  userId?: number;
  userEmail?: string;
  isAdmin?: boolean;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.isAdmin = payload.isAdmin;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.isAdmin) {
    res.status(403).json({ message: "Administrator access required" });
    return;
  }
  next();
}
