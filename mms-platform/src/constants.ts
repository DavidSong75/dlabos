// 콘텐츠 등급 + 정산 규칙 (기획서 기준)
export const CONTENT_STATUSES = [
  "Draft", "Review", "Revision", "Rejected", "Verified", "Popular", "Signature",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

// Verified 이상만 마켓 공개·구매(도입) 가능
export const PUBLIC_GRADES: ContentStatus[] = ["Verified", "Popular", "Signature"];
export const isPublicGrade = (s: string) => PUBLIC_GRADES.includes(s as ContentStatus);

// 마켓 목록 노출: 반려(Rejected)만 숨김. Draft~Revision은 보이되 구매 불가.
export const isListedGrade = (s: string) => s !== "Rejected";

export const ROLES = ["creator", "campus_director", "hq_reviewer", "hq_admin"] as const;
export type Role = (typeof ROLES)[number];

// 본사 검수자/관리자만 검수 가능
export const canReview = (role: string) => role === "hq_reviewer" || role === "hq_admin";

// 정산 규칙
export const HQ_RATE = 0.3;       // 콘텐츠 사용료 중 본사 운영비
export const CREATOR_RATE = 0.7;  // 제작자(제작 캠퍼스) 수익
export const ROYALTY_RATE = 0.06; // 가맹 로열티 = 교육 매출의 6% (콘텐츠와 별개)

export const GRADE_LABEL: Record<string, string> = {
  Draft: "초안", Review: "검토중", Revision: "보완요청", Rejected: "반려",
  Verified: "승인", Popular: "인기", Signature: "대표",
};
