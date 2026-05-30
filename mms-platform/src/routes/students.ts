import { Router } from "express";
import { prisma } from "../db.js";

export const studentsRouter = Router();

// 학생 목록 (?campusId / ?classGroupId)
studentsRouter.get("/", async (req, res) => {
  const where: any = {};
  if (req.query.campusId) where.campusId = String(req.query.campusId);
  if (req.query.classGroupId) where.classGroupId = String(req.query.classGroupId);
  const list = await prisma.student.findMany({
    where, include: { classGroup: true }, orderBy: { points: "desc" },
  });
  res.json(list.map((s) => ({
    id: s.id, name: s.name, phoneLast4: s.phoneLast4, className: s.classGroup?.name,
    points: s.points, balance: s.balance, level: s.level,
  })));
});

studentsRouter.get("/:id", async (req, res) => {
  const s = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: { classGroup: true, attendances: { orderBy: { checkedInAt: "desc" }, take: 10 }, progresses: { include: { curriculum: true } } },
  });
  if (!s) return res.status(404).json({ error: "학생을 찾을 수 없습니다." });
  res.json(s);
});
