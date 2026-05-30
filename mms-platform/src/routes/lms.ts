import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { summarizeLesson } from "../services/ai.js";
import { sendKakao } from "../services/notify.js";

export const lmsRouter = Router();

// 커리큘럼(주차 포함)
lmsRouter.get("/curriculum", async (_req, res) => {
  const list = await prisma.curriculum.findMany({ include: { weeks: { orderBy: { week: "asc" } } } });
  res.json(list);
});

// 학생 진도
lmsRouter.get("/progress", async (req, res) => {
  const where: any = {};
  if (req.query.studentId) where.studentId = String(req.query.studentId);
  const list = await prisma.progress.findMany({ where, include: { curriculum: { include: { weeks: true } }, student: true } });
  res.json(list.map((p) => ({
    studentId: p.studentId, studentName: p.student.name, curriculum: p.curriculum.name,
    totalWeeks: p.curriculum.totalWeeks, currentWeek: p.currentWeek,
    percent: Math.round((p.currentWeek / p.curriculum.totalWeeks) * 100),
  })));
});

// 수업 기록 생성 + AI 요약(stub)
const lessonSchema = z.object({
  classGroupId: z.string().min(1),
  date: z.string().optional(),
  transcript: z.string().default(""),
});
lmsRouter.post("/lessons", async (req, res) => {
  const parsed = lessonSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "수업 정보를 확인하세요." });
  const cls = await prisma.classGroup.findUnique({ where: { id: parsed.data.classGroupId }, include: { students: true } });
  if (!cls) return res.status(404).json({ error: "반을 찾을 수 없습니다." });
  const ai = summarizeLesson(parsed.data.transcript, { students: cls.students.map((s) => s.name) });
  const lesson = await prisma.lesson.create({
    data: { classGroupId: cls.id, date: parsed.data.date ?? "", transcript: parsed.data.transcript, aiSummary: ai.summary },
  });
  res.status(201).json({ lesson, ai });
});

// 수업 기록 목록
lmsRouter.get("/lessons", async (req, res) => {
  const where: any = {};
  if (req.query.classGroupId) where.classGroupId = String(req.query.classGroupId);
  const list = await prisma.lesson.findMany({ where, include: { classGroup: true }, orderBy: { createdAt: "desc" }, take: 50 });
  res.json(list);
});

// 리포트 발송(stub) — 반 학부모에게 AI 요약 알림톡
lmsRouter.post("/lessons/:id/send-report", async (req, res) => {
  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id }, include: { classGroup: { include: { students: true } } } });
  if (!lesson) return res.status(404).json({ error: "수업 기록을 찾을 수 없습니다." });
  let sent = 0;
  for (const s of lesson.classGroup.students) {
    await sendKakao(s.parentPhone || "학부모", "report", { name: s.name, summary: lesson.aiSummary });
    sent++;
  }
  await prisma.lesson.update({ where: { id: lesson.id }, data: { reportSent: true } });
  res.json({ ok: true, sent });
});
