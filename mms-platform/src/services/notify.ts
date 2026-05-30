import { prisma } from "../db.js";

// 카카오 알림톡 — 실연동 + stub 폴백.
// KAKAO_API_KEY + KAKAO_SENDER 가 설정되면 실제 발송(provider HTTP)을 시도하고, 없으면 stub(DB 기록).
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
  let status = "sent";
  if (process.env.KAKAO_API_KEY && process.env.KAKAO_SENDER) {
    try {
      await liveSend(to, t.title, t.body);
    } catch (e) {
      status = "failed";
      console.error("[알림톡] 실발송 실패:", (e as Error).message);
    }
  } else {
    console.log(`[알림톡 stub] → ${to} (${template}): ${t.body.split("\n")[0]}`);
  }
  return prisma.notification.create({
    data: { channel: "kakao", to, template, title: t.title, body: t.body, status },
  });
}

// 실제 알림톡 발송 자리 — 카카오 비즈메시지/대행사(API 키·발신프로필) 연동.
// provider 별 엔드포인트/페이로드가 다르므로 계약 후 본문을 맞춰 구현.
async function liveSend(to: string, title: string, body: string) {
  const url = process.env.KAKAO_API_URL;
  if (!url) throw new Error("KAKAO_API_URL 미설정");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${process.env.KAKAO_API_KEY}` },
    body: JSON.stringify({ from: process.env.KAKAO_SENDER, to, title, text: body }),
  });
  if (!res.ok) throw new Error("KAKAO HTTP " + res.status);
}
