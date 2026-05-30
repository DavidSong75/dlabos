import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
  campusId: string | null;
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

// 요청에 user를 붙임. 토큰 없으면 그냥 통과(공개 엔드포인트 대비), 잘못된 토큰만 거부.
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      (req as any).user = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    } catch {
      /* 무효 토큰은 비로그인으로 처리 */
    }
  }
  next();
}

export function getUser(req: Request): AuthUser | null {
  return (req as any).user || null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!getUser(req)) return res.status(401).json({ error: "로그인이 필요합니다." });
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: "로그인이 필요합니다." });
    if (!roles.includes(user.role))
      return res.status(403).json({ error: "권한이 없습니다." });
    next();
  };
}
