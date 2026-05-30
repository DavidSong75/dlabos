import { prisma } from "../db.js";

// 결제 stub PG — 실제 결제 게이트웨이 연동 자리. 지금은 항상 성공 처리하고 기록만 남김.
// 실제 연동 시 charge() 안에서 PG API를 호출하고 결과로 status를 결정하면 됨.
export async function charge(input: {
  campusId: string;
  studentId?: string | null;
  type: string; // tuition | deposit | content | material
  amount: number;
  method?: string;
  memo?: string;
}) {
  const payment = await prisma.payment.create({
    data: {
      campusId: input.campusId,
      studentId: input.studentId ?? null,
      type: input.type,
      amount: input.amount,
      method: input.method ?? "card",
      status: "완료",
      memo: input.memo ?? "",
    },
  });
  // 예치금 충전이면 캠퍼스 잔액 증가
  if (input.type === "deposit") {
    await prisma.campus.update({ where: { id: input.campusId }, data: { deposit: { increment: input.amount } } });
  }
  return payment;
}
