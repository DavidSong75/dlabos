import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { sendKakao } from "../services/notify.js";

export const attendanceRouter = Router();

const ATTEND_POINTS = 30;

// 출석 키오스크: 전화번호 뒤 4자리 → 출석 처리 + 포인트 + 학부모 알림톡(stub)
const checkinSchema = z.object({ phoneLast4: z.string().length(4), campusId: z.string().min(1) });

attendanceRouter.post("/checkin", async (req, res) => {
  const parsed = checkinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "전화번호 뒤 4자리와 캠퍼스를 확인하세요." });
  const matches = await prisma.student.findMany({
    where: { phoneLast4: parsed.data.phoneLast4, campusId: parsed.data.campusId },
    include: { classGroup: true },
  });
  if (matches.length === 0) return res.status(404).json({ error: "일치하는 학생이 없습니다." });
  // 동명이번호: 여러 명이면 선택 목록 반환(기획서 5번)
  if (matches.length > 1)
    return res.json({ multiple: true, students: matches.map((s) => ({ id: s.id, name: s.name, className: s.classGroup?.name })) });

  return res.json(await doCheckin(matches[0].id));
});

// 동명이번호 선택 후 확정 출석
attendanceRouter.post("/checkin/:studentId", async (req, res) => {
  const s = await prisma.student.findUnique({ where: { id: req.params.studentId } });
  if (!s) return res.status(404).json({ error: "학생을 찾을 수 없습니다." });
  res.json(await doCheckin(s.id));
});

async function doCheckin(studentId: string) {
  const now = new Date();
  const time = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const [student] = await prisma.$transaction([
    prisma.student.update({
      where: { id: studentId },
      data: { points: { increment: ATTEND_POINTS }, balance: { increment: ATTEND_POINTS } },
      include: { classGroup: true },
    }),
    prisma.attendance.create({ data: { studentId, campusId: (await prisma.student.findUnique({ where: { id: studentId } }))!.campusId, points: ATTEND_POINTS } }),
  ]);
  // 학부모 알림톡(stub)
  const noti = await sendKakao(student.parentPhone || "학부모", "attendance_in", { name: student.name, time });
  // 캠퍼스 랭킹(누적 포인트 기준)
  const ranked = await prisma.student.findMany({ where: { campusId: student.campusId }, orderBy: { points: "desc" }, select: { id: true, name: true, points: true } });
  const rank = ranked.findIndex((r) => r.id === student.id) + 1;
  return {
    ok: true,
    student: {
      id: student.id, name: student.name, className: student.classGroup?.name,
      teacher: student.classGroup?.teacher, room: student.classGroup?.room,
      points: student.points, balance: student.balance, level: student.level,
      earned: ATTEND_POINTS, rank, campusTotal: ranked.length,
    },
    leaderboard: ranked.slice(0, 3),
    notification: { to: noti.to, body: noti.body },
    checkinTime: time,
  };
}

// 출석 기록
attendanceRouter.get("/", async (req, res) => {
  const where: any = {};
  if (req.query.campusId) where.campusId = String(req.query.campusId);
  const list = await prisma.attendance.findMany({
    where, include: { student: true }, orderBy: { checkedInAt: "desc" }, take: 50,
  });
  res.json(list.map((a) => ({ id: a.id, studentName: a.student.name, status: a.status, points: a.points, checkedInAt: a.checkedInAt })));
});
