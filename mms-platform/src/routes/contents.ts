import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { getUser, requireAuth, requireRole } from "../auth.js";
import { isPublicGrade, isListedGrade, GRADE_LABEL } from "../constants.js";
import { UPLOAD_DIR } from "../config.js";

export const contentsRouter = Router();

// ---- 파일 업로드 (수업 자료) ----
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = crypto.randomBytes(8).toString("hex") + path.extname(file.originalname);
    cb(null, safe);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// 콘텐츠 직렬화 + 집계(수강 학생 수, 사용 캠퍼스 수)
async function serialize(c: any) {
  const usages = c.usages ?? (await prisma.usage.findMany({ where: { contentId: c.id } }));
  const totalStudents = usages.reduce((a: number, u: any) => a + u.studentCount, 0);
  const campusCount = new Set(usages.map((u: any) => u.campusId)).size;
  return {
    id: c.id, title: c.title, gradeLevel: c.gradeLevel, difficulty: c.difficulty,
    pricePerStudent: c.pricePerStudent, status: c.status, statusLabel: GRADE_LABEL[c.status] ?? c.status,
    summary: c.summary, description: c.description, teacherGuide: c.teacherGuide,
    studentMaterial: c.studentMaterial, outcome: c.outcome, rubric: c.rubric,
    rating: c.rating, reviewNote: c.reviewNote,
    creator: c.creator ? { id: c.creator.id, name: c.creator.name } : undefined,
    campusId: c.campusId, campusName: c.campus?.name,
    files: (c.files ?? []).map((f: any) => ({ id: f.id, name: f.originalName, size: f.size })),
    totalStudents, campusCount,
    isPublic: isPublicGrade(c.status),
  };
}

// ---- 목록 ----
// scope=market: Verified 이상만 (마켓)
// scope=listed: 반려 제외 전부 (마켓에서 검수 단계도 열람)
// scope=mine: 내가 만든 콘텐츠
// scope=pending: 검수 대기(Draft/Review/Revision) — 본사 검수자용
contentsRouter.get("/", async (req, res) => {
  const scope = String(req.query.scope || "market");
  const user = getUser(req);
  const all = await prisma.content.findMany({
    include: { creator: true, campus: true, files: true, usages: true },
    orderBy: { updatedAt: "desc" },
  });
  let list = all;
  if (scope === "market") list = all.filter((c) => isPublicGrade(c.status));
  else if (scope === "listed") list = all.filter((c) => isListedGrade(c.status));
  else if (scope === "mine") list = all.filter((c) => user && c.creatorId === user.id);
  else if (scope === "pending")
    list = all.filter((c) => ["Draft", "Review", "Revision"].includes(c.status));
  res.json(await Promise.all(list.map(serialize)));
});

// ---- 상세 ----
contentsRouter.get("/:id", async (req, res) => {
  const c = await prisma.content.findUnique({
    where: { id: req.params.id },
    include: { creator: true, campus: true, files: true, usages: true },
  });
  if (!c) return res.status(404).json({ error: "콘텐츠를 찾을 수 없습니다." });
  res.json(await serialize(c));
});

// ---- 등록 (Draft) ----
const createSchema = z.object({
  title: z.string().min(1),
  gradeLevel: z.string().min(1),
  difficulty: z.string().min(1),
  pricePerStudent: z.coerce.number().int().min(0),
  summary: z.string().optional(),
  description: z.string().optional(),
  teacherGuide: z.string().optional(),
  studentMaterial: z.string().optional(),
  outcome: z.string().optional(),
  rubric: z.string().optional(),
});

contentsRouter.post("/", requireAuth, async (req, res) => {
  const user = getUser(req)!;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "필수 항목을 확인하세요.", detail: parsed.error.flatten() });
  if (!user.campusId) return res.status(400).json({ error: "소속 캠퍼스가 없는 계정입니다." });
  const c = await prisma.content.create({
    data: { ...parsed.data, creatorId: user.id, campusId: user.campusId, status: "Draft" },
    include: { creator: true, campus: true, files: true, usages: true },
  });
  res.status(201).json(await serialize(c));
});

// ---- 수정 (Draft/Revision 상태에서 제작자만) ----
contentsRouter.patch("/:id", requireAuth, async (req, res) => {
  const user = getUser(req)!;
  const c = await prisma.content.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: "콘텐츠를 찾을 수 없습니다." });
  if (c.creatorId !== user.id) return res.status(403).json({ error: "본인 콘텐츠만 수정할 수 있습니다." });
  if (!["Draft", "Revision"].includes(c.status))
    return res.status(400).json({ error: "초안/보완요청 상태에서만 수정할 수 있습니다." });
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "입력값을 확인하세요." });
  const updated = await prisma.content.update({
    where: { id: c.id }, data: parsed.data,
    include: { creator: true, campus: true, files: true, usages: true },
  });
  res.json(await serialize(updated));
});

// ---- 파일 첨부 ----
contentsRouter.post("/:id/files", requireAuth, upload.array("files", 10), async (req, res) => {
  const user = getUser(req)!;
  const c = await prisma.content.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: "콘텐츠를 찾을 수 없습니다." });
  if (c.creatorId !== user.id) return res.status(403).json({ error: "본인 콘텐츠만 첨부할 수 있습니다." });
  const files = (req.files as Express.Multer.File[]) ?? [];
  for (const f of files) {
    await prisma.contentFile.create({
      data: { contentId: c.id, filename: f.filename, originalName: f.originalname, mimeType: f.mimetype, size: f.size },
    });
  }
  const full = await prisma.content.findUnique({
    where: { id: c.id }, include: { creator: true, campus: true, files: true, usages: true },
  });
  res.json(await serialize(full));
});

// ---- 검토 요청 (Draft/Revision → Review) : 제작자 ----
contentsRouter.post("/:id/submit", requireAuth, async (req, res) => {
  const user = getUser(req)!;
  const c = await prisma.content.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: "콘텐츠를 찾을 수 없습니다." });
  if (c.creatorId !== user.id) return res.status(403).json({ error: "본인 콘텐츠만 제출할 수 있습니다." });
  if (!["Draft", "Revision"].includes(c.status))
    return res.status(400).json({ error: "초안/보완요청 상태에서만 검토 요청할 수 있습니다." });
  await transition(c.id, c.status, "Review", "", user.name);
  res.json({ ok: true });
});

// ---- 본사 검수 (상태 전환) : 검수자/관리자 ----
const reviewSchema = z.object({
  toStatus: z.enum(["Verified", "Revision", "Rejected", "Popular", "Signature", "Review"]),
  note: z.string().optional(),
});
contentsRouter.post("/:id/review", requireAuth, requireRole("hq_reviewer", "hq_admin"), async (req, res) => {
  const user = getUser(req)!;
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "전환 상태가 올바르지 않습니다." });
  const c = await prisma.content.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: "콘텐츠를 찾을 수 없습니다." });
  // 승격(Popular/Signature)은 공개 콘텐츠에서만
  if (["Popular", "Signature"].includes(parsed.data.toStatus) && !isPublicGrade(c.status))
    return res.status(400).json({ error: "Verified 이상에서만 승격할 수 있습니다." });
  await transition(c.id, c.status, parsed.data.toStatus, parsed.data.note || "", user.name);
  res.json({ ok: true });
});

async function transition(id: string, from: string, to: string, note: string, reviewer: string) {
  await prisma.$transaction([
    prisma.content.update({ where: { id }, data: { status: to, reviewNote: note } }),
    prisma.reviewLog.create({ data: { contentId: id, fromStatus: from, toStatus: to, note, reviewer } }),
  ]);
}
