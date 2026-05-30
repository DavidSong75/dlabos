import { Router } from "express";
import { prisma } from "../db.js";
import { sendKakao } from "../services/notify.js";

export const notificationsRouter = Router();

// 알림톡 발송 기록(최근)
notificationsRouter.get("/", async (req, res) => {
  const where: any = {};
  if (req.query.to) where.to = String(req.query.to);
  const list = await prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 });
  res.json(list);
});

// 수동 발송(stub)
notificationsRouter.post("/", async (req, res) => {
  const { to, template, vars } = req.body ?? {};
  if (!to || !template) return res.status(400).json({ error: "to, template이 필요합니다." });
  const n = await sendKakao(String(to), String(template), vars ?? {});
  res.status(201).json(n);
});
