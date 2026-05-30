import { prisma } from "../db.js";

// 카카오 알림톡 stub — 실제 발송 대신 DB에 기록하고 콘솔 로그.
// 실제 연동 시 이 함수 본문만 알림톡 API 호출로 교체하면 됨.
type Vars = Record<string, string | number>;

const TEMPLATES: Record<string, (v: Vars) => { title: string; body: string }> = {
  attendance_in: (v) => ({
    title: "입실 알림",
    body: `미래의 주커버그, ${v.name}이(가) 오늘 D.LAB에 도착했습니다.\n입실 시간: ${v.time}\n오늘도 새로운 문제를 해결하러 왔습니다.`,
  }),
  payment: (v) => ({
    title: "결제 완료",
    body: `${v.name ?? ""} ${v.label ?? "수강료"} ${Number(v.amount).toLocaleString("ko-KR")}원이 결제되었습니다.\n결제 수단: ${v.method ?? "카드"}`,
  }),
  report: (v) => ({
    title: "수업 리포트",
    body: `${v.name} 학생의 오늘 수업 기록입니다.\n${v.summary}`,
  }),
};

export async function sendKakao(to: string, template: string, vars: Vars = {}) {
  const t = TEMPLATES[template]?.(vars) ?? { title: "", body: String(vars.body ?? "") };
  const n = await prisma.notification.create({
    data: { channel: "kakao", to, template, title: t.title, body: t.body, status: "sent" },
  });
  console.log(`[알림톡 stub] → ${to} (${template}): ${t.body.split("\n")[0]}`);
  return n;
}
