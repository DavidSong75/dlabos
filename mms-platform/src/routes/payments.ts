import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { charge } from "../services/payment.js";
import { sendKakao } from "../services/notify.js";

export const paymentsRouter = Router();

const paySchema = z.object({
  campusId: z.string().min(1),
  studentId: z.string().optional(),
  type: z.enum(["tuition", "deposit", "content", "material"]),
  amount: z.coerce.number().int().min(0),
  method: z.string().optional(),
  memo: z.string().optional(),
});

// 결제 생성 (stub PG) + 결제 알림톡(수강료일 때)
paymentsRouter.post("/", async (req, res) => {
  const parsed = paySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "결제 정보를 확인하세요." });
  const payment = await charge(parsed.data);
  if (parsed.data.type === "tuition" && parsed.data.studentId) {
    const s = await prisma.student.findUnique({ where: { id: parsed.data.studentId } });
    if (s) await sendKakao(s.parentPhone || "학부모", "payment", { name: s.name, label: "수강료", amount: parsed.data.amount, method: parsed.data.method ?? "카드" });
  }
  res.status(201).json(payment);
});

// 결제 내역 (?campusId / ?type / ?status)
paymentsRouter.get("/", async (req, res) => {
  const where: any = {};
  if (req.query.campusId) where.campusId = String(req.query.campusId);
  if (req.query.type) where.type = String(req.query.type);
  if (req.query.status) where.status = String(req.query.status);
  const list = await prisma.payment.findMany({
    where, include: { student: true }, orderBy: { createdAt: "desc" }, take: 100,
  });
  const summary = {
    완료: list.filter((p) => p.status === "완료").reduce((a, p) => a + p.amount, 0),
    미납: list.filter((p) => p.status === "미납").reduce((a, p) => a + p.amount, 0),
    count: list.length,
  };
  res.json({
    rows: list.map((p) => ({ id: p.id, type: p.type, amount: p.amount, method: p.method, status: p.status, studentName: p.student?.name ?? null, memo: p.memo, createdAt: p.createdAt })),
    summary,
  });
});
