# D.LAB MMS — 콘텐츠 마켓 (풀스택)

콘텐츠 마켓 기획서 기반 **업로드 → 본사 검수 → 마켓 공개 → 수업 사용 → 정산** 풀스택 구현.
기존 단일 HTML 프로토타입과 **독립된 프로젝트**입니다. (프로토타입은 `frontend-prototype` 브랜치 / `frontend-prototype-v1` 태그에 보관)

## 스택
- **백엔드**: Node + Express + TypeScript, Prisma ORM, **SQLite** (무설치 실행 · Postgres로 이전 용이)
- **인증**: JWT + bcrypt, 역할 기반 가드(creator / campus_director / hq_reviewer / hq_admin)
- **검증**: Zod
- **프론트**: 정적 SPA(vanilla JS) — 다크 브랜드 UI, Express가 함께 서빙

## 실행
```bash
cd mms-platform
npm install
npm run setup     # prisma generate + db push + seed (최초 1회)
npm start         # http://localhost:4000
```
> 재시드: `npm run db:reset`

## 데모 계정 (비밀번호 모두 `1234`)
| 아이디 | 이름 | 역할 |
|---|---|---|
| `soojin` | 이수진 | 제작자(분당) |
| `minho` | 박민호 | 제작자(분당) |
| `director` | 분당 원장 | 캠퍼스장 |
| `hq` | 본사 검수자 | 검수 |
| `admin` | 본사 관리자 | 관리 |

## 핵심 흐름
1. **제작자**: 콘텐츠 등록(Draft, 파일 첨부) → 검토 요청(Review)
2. **본사 검수자**: 체크리스트 확인 → Verified 승인 / 보완(Revision) / 반려(Rejected), Verified→Popular→Signature 승격
3. **마켓**: Verified 이상만 구매·사용 가능. Draft·검토중·보완요청은 열람만(구매 불가), 반려는 비공개
4. **캠퍼스장**: Verified 콘텐츠 도입 → 수업 사용 등록(반·날짜·강사·실제 수강 학생 수)
5. **정산**: 콘텐츠 사용료 = 1인 단가 × 사용 학생 수 → **본사 운영비 30% / 제작자 70%**. 별도로 **가맹 로열티 = 교육 매출의 6%**

## 주요 API
- `POST /api/auth/login`
- `GET /api/contents?scope=market|listed|mine|pending`, `GET /api/contents/:id`
- `POST /api/contents` (등록), `POST /api/contents/:id/files` (첨부), `POST /api/contents/:id/submit` (검토요청)
- `POST /api/contents/:id/review` (본사 검수: Verified/Revision/Rejected/Popular/Signature)
- `POST /api/usage` (수업 사용 등록), `GET /api/usage?campusId=`
- `GET /api/settlement`, `GET /api/settlement/by-campus`

## 확장 도메인 (출석 / 결제 / 알림톡 / LMS) + Stub 모듈
운영 도메인을 백엔드로 확장했습니다. 결제·알림톡·AI는 **stub 서비스**(`src/services/`)로, 실제 PG/카카오/LLM 연동 자리만 마련해두고 지금은 시뮬레이션으로 동작합니다.

- **출석** `POST /api/attendance/checkin {phoneLast4, campusId}` → 출석 처리 +30P, 동명이번호 선택, **학부모 알림톡 자동 발송(stub)**, 캠퍼스 랭킹 반환 · `POST /api/attendance/checkin/:studentId` · `GET /api/attendance?campusId=`
- **학생** `GET /api/students?campusId=&classGroupId=`, `GET /api/students/:id`
- **결제(stub PG)** `POST /api/payments {campusId,type,amount,...}` (tuition/deposit/content/material), `GET /api/payments?campusId=` · 예치금 충전 시 캠퍼스 잔액 증가, 수강료 결제 시 알림톡 발송
- **알림톡(stub)** `GET /api/notifications`, `POST /api/notifications {to,template,vars}` — 발송 내역 DB 기록
- **LMS** `GET /api/lms/curriculum`(주차 포함), `GET /api/lms/progress?studentId=`, `POST /api/lms/lessons {classGroupId,transcript}` → **AI 수업 요약(stub)**, `POST /api/lms/lessons/:id/send-report` → 반 학부모 리포트 알림톡

> Stub 위치: `src/services/payment.ts`(PG), `src/services/notify.ts`(카카오 알림톡), `src/services/ai.ts`(수업 요약). 실연동 시 각 함수 본문만 교체.
