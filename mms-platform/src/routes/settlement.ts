import { Router } from "express";
import { prisma } from "../db.js";
import { HQ_RATE, CREATOR_RATE, ROYALTY_RATE, isPublicGrade } from "../constants.js";

export const settlementRouter = Router();

// 콘텐츠 정산: 1인 단가 × 사용 학생 수 → 본사 운영비 30% / 제작자 70%
// 콘텐츠 × 캠퍼스별 상세 + 합계
settlementRouter.get("/", async (_req, res) => {
  const usages = await prisma.usage.findMany({ include: { content: { include: { creator: true } }, campus: true } });
  const rows = usages
    .filter((u) => isPublicGrade(u.content.status))
    .map((u) => {
      const gross = u.content.pricePerStudent * u.studentCount;
      return {
        contentId: u.contentId, contentTitle: u.content.title, creator: u.content.creator.name,
        campusId: u.campusId, campusName: u.campus.name, students: u.studentCount,
        pricePerStudent: u.content.pricePerStudent, gross,
        hqShare: Math.round(gross * HQ_RATE), creatorShare: Math.round(gross * CREATOR_RATE),
      };
    });
  const totalGross = rows.reduce((a, r) => a + r.gross, 0);
  res.json({
    rows,
    summary: {
      totalGross,
      hqOperating: Math.round(totalGross * HQ_RATE),   // 본사 운영비 30%
      creatorPayout: Math.round(totalGross * CREATOR_RATE), // 제작자 70%
      hqRate: HQ_RATE, creatorRate: CREATOR_RATE,
    },
  });
});

// 캠퍼스별 청구(원장 부담) + 로열티(교육 매출 6%)
settlementRouter.get("/by-campus", async (_req, res) => {
  const campuses = await prisma.campus.findMany();
  const usages = await prisma.usage.findMany({ include: { content: true } });
  const result = campuses.map((c) => {
    const cu = usages.filter((u) => u.campusId === c.id && isPublicGrade(u.content.status));
    const contentCost = cu.reduce((a, u) => a + u.content.pricePerStudent * u.studentCount, 0);
    const royalty = Math.round(c.revenue * ROYALTY_RATE);
    return {
      campusId: c.id, campusName: c.name, type: c.type, revenue: c.revenue,
      royaltyRate: ROYALTY_RATE, royalty,            // 가맹 로열티(매출 6%)
      contentCost,                                    // 콘텐츠 사용료(별개)
      contentItems: cu.length,
      hqTotal: royalty + contentCost,                 // 본사 납부 합계
    };
  });
  res.json({
    rows: result,
    summary: {
      totalRoyalty: result.reduce((a, r) => a + r.royalty, 0),
      totalContentCost: result.reduce((a, r) => a + r.contentCost, 0),
    },
  });
});
