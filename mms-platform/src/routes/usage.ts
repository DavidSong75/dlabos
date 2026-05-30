import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { getUser, requireAuth } from "../auth.js";
import { isPublicGrade } from "../constants.js";

export const usageRouter = Router();

const usageSchema = z.object({
  contentId: z.string().min(1),
  classroom: z.string().optional(),
  teacher: z.string().optional(),
  studentCount: z.coerce.number().int().min(1),
  sessionDate: z.string().optional(),
  note: z.string().optional(),
});

// 수업 사용 등록 — Verified 이상 콘텐츠만, 본인 캠퍼스로 기록
usageRouter.post("/", requireAuth, async (req, res) => {
  const user = getUser(req)!;
  const parsed = usageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "사용 학생 수 등 입력값을 확인하세요." });
  if (!user.campusId) return res.status(400).json({ error: "소속 캠퍼스가 없는 계정입니다." });

  const content = await prisma.content.findUnique({ where: { id: parsed.data.contentId } });
  if (!content) return res.status(404).json({ error: "콘텐츠를 찾을 수 없습니다." });
  if (!isPublicGrade(content.status))
    return res.status(400).json({ error: "Verified 이상(구매 가능) 콘텐츠만 사용 등록할 수 있습니다." });

  const usage = await prisma.usage.create({
    data: {
      contentId: parsed.data.contentId,
      campusId: user.campusId,
      classroom: parsed.data.classroom ?? "",
      teacher: parsed.data.teacher ?? "",
      studentCount: parsed.data.studentCount,
      sessionDate: parsed.data.sessionDate ?? "",
      note: parsed.data.note ?? "",
    },
  });
  res.status(201).json(usage);
});

// 사용 기록 조회 (?campusId / ?contentId)
usageRouter.get("/", async (req, res) => {
  const where: any = {};
  if (req.query.campusId) where.campusId = String(req.query.campusId);
  if (req.query.contentId) where.contentId = String(req.query.contentId);
  const usages = await prisma.usage.findMany({
    where, include: { content: true, campus: true }, orderBy: { createdAt: "desc" },
  });
  res.json(usages.map((u) => ({
    id: u.id, contentId: u.contentId, contentTitle: u.content.title, pricePerStudent: u.content.pricePerStudent,
    campusId: u.campusId, campusName: u.campus.name, classroom: u.classroom, teacher: u.teacher,
    studentCount: u.studentCount, sessionDate: u.sessionDate, note: u.note,
    charge: u.content.pricePerStudent * u.studentCount,
  })));
});
