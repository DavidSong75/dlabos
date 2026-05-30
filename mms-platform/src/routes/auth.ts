import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { signToken } from "../auth.js";

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "아이디/비밀번호를 입력하세요." });
  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username }, include: { campus: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });

  const authUser = { id: user.id, username: user.username, name: user.name, role: user.role, campusId: user.campusId };
  res.json({
    token: signToken(authUser),
    user: { ...authUser, campusName: user.campus?.name ?? null },
  });
});

// 데모 편의용 계정 목록(비밀번호 노출 X, 로그인 화면 빠른 선택용)
authRouter.get("/demo-accounts", async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { campus: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(users.map((u) => ({
    username: u.username, name: u.name, role: u.role, campusName: u.campus?.name ?? null,
  })));
});
