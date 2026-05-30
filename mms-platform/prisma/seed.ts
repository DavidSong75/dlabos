import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";

async function main() {
  // 초기화 (의존 순서)
  await prisma.reviewLog.deleteMany();
  await prisma.usage.deleteMany();
  await prisma.contentFile.deleteMany();
  await prisma.content.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.progress.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.curriculumWeek.deleteMany();
  await prisma.curriculum.deleteMany();
  await prisma.student.deleteMany();
  await prisma.classGroup.deleteMany();
  await prisma.user.deleteMany();
  await prisma.campus.deleteMany();

  const pw = await bcrypt.hash("1234", 10);

  const pangyo = await prisma.campus.create({ data: { name: "판교 직영캠퍼스", type: "직영", revenue: 41300000 } });
  const bundang = await prisma.campus.create({ data: { name: "분당 직영캠퍼스", type: "직영", revenue: 33200000 } });
  const gangnam = await prisma.campus.create({ data: { name: "강남 우수가맹", type: "가맹", revenue: 26400000 } });
  const songdo = await prisma.campus.create({ data: { name: "송도 가맹", type: "가맹", revenue: 17500000 } });

  const soojin = await prisma.user.create({ data: { username: "soojin", name: "이수진", passwordHash: pw, role: "creator", campusId: bundang.id } });
  const minho = await prisma.user.create({ data: { username: "minho", name: "박민호", passwordHash: pw, role: "creator", campusId: bundang.id } });
  const jhyun = await prisma.user.create({ data: { username: "jhyun", name: "김정현", passwordHash: pw, role: "creator", campusId: pangyo.id } });
  const hana = await prisma.user.create({ data: { username: "hana", name: "정하나", passwordHash: pw, role: "creator", campusId: gangnam.id } });
  await prisma.user.create({ data: { username: "director", name: "분당 원장", passwordHash: pw, role: "campus_director", campusId: bundang.id } });
  await prisma.user.create({ data: { username: "hq", name: "본사 검수자", passwordHash: pw, role: "hq_reviewer" } });
  await prisma.user.create({ data: { username: "admin", name: "본사 관리자", passwordHash: pw, role: "hq_admin" } });

  const mk = (d: any) => prisma.content.create({ data: d });

  const c1 = await mk({ title: "코딩 사고력: 순서도와 조건문", gradeLevel: "초등 3~4", difficulty: "입문", pricePerStudent: 15000, status: "Signature", rating: 4.8, creatorId: soojin.id, campusId: bundang.id, summary: "순서도로 조건문 논리 구조 학습", description: "순서도 기반으로 조건문의 논리 구조를 학습합니다.", teacherGuide: "110분 수업 흐름 + 교사 멘트 포함", studentMaterial: "활동지 3종", outcome: "조건 분기 미니 프로그램", rubric: "논리성/완성도/발표력" });
  const c2 = await mk({ title: "파이썬 데이터 분석 기초", gradeLevel: "중등", difficulty: "중급", pricePerStudent: 22000, status: "Review", rating: 0, creatorId: jhyun.id, campusId: pangyo.id, summary: "판다스/시각화 입문", description: "판다스와 matplotlib을 활용한 데이터 시각화 입문." });
  const c3 = await mk({ title: "아두이노 IoT 프로젝트", gradeLevel: "초등 5~6", difficulty: "중급", pricePerStudent: 28000, status: "Verified", rating: 4.5, creatorId: minho.id, campusId: bundang.id, summary: "센서·액추에이터 IoT", description: "센서와 액추에이터를 활용한 IoT 프로젝트 수업." });
  await mk({ title: "AI 챗봇 만들기", gradeLevel: "중등", difficulty: "고급", pricePerStudent: 35000, status: "Revision", rating: 0, creatorId: hana.id, campusId: gangnam.id, summary: "OpenAI API 챗봇", description: "OpenAI API를 활용한 챗봇 제작 프로젝트.", reviewNote: "학생용 활동지와 결과물 예시 보완이 필요합니다." });
  const c5 = await mk({ title: "스크래치 게임 개발", gradeLevel: "초등 1~2", difficulty: "입문", pricePerStudent: 12000, status: "Popular", rating: 4.9, creatorId: soojin.id, campusId: bundang.id, summary: "블록 코딩 게임", description: "블록 코딩으로 나만의 게임을 만들어봅니다." });
  await mk({ title: "AI 이미지 생성 워크숍", gradeLevel: "중등", difficulty: "중급", pricePerStudent: 26000, status: "Draft", rating: 0, creatorId: soojin.id, campusId: bundang.id, summary: "생성형 AI 이미지", description: "생성형 AI로 나만의 이미지를 만드는 1회차 워크숍 (작성 중)." });
  await mk({ title: "엔트리 자율주행 만들기", gradeLevel: "초등 5~6", difficulty: "중급", pricePerStudent: 24000, status: "Rejected", rating: 0, creatorId: minho.id, campusId: bundang.id, summary: "엔트리 자율주행", description: "저작권 확인이 필요하여 반려된 콘텐츠.", reviewNote: "외부 교재 이미지 저작권 확인 필요." });

  // 사용 기록 (Verified 이상만) — 캠퍼스별 수강 학생 수
  const usage = (contentId: string, campusId: string, students: number, classroom: string, teacher: string) =>
    prisma.usage.create({ data: { contentId, campusId, studentCount: students, classroom, teacher, sessionDate: "2026-05" } });

  await usage(c1.id, pangyo.id, 10, "알고리즘 A", "김정현");
  await usage(c1.id, bundang.id, 12, "알고리즘 A", "이수진");
  await usage(c1.id, gangnam.id, 7, "AI 프로젝트", "정하나");
  await usage(c1.id, songdo.id, 5, "코딩 입문", "강사");
  await usage(c3.id, bundang.id, 12, "메이커 C", "박민호");
  await usage(c5.id, pangyo.id, 12, "스크래치반", "김정현");
  await usage(c5.id, bundang.id, 14, "스크래치반", "이수진");
  await usage(c5.id, gangnam.id, 9, "게임반", "정하나");
  await usage(c5.id, songdo.id, 7, "게임반", "강사");

  // ===== 반(ClassGroup) =====
  const algoA = await prisma.classGroup.create({ data: { name: "알고리즘 A", campusId: bundang.id, teacher: "이수진", room: "301", schedule: "월/수 15:30~17:00" } });
  const pythonB = await prisma.classGroup.create({ data: { name: "파이썬 기초 B", campusId: bundang.id, teacher: "박민호", room: "302", schedule: "화/목 17:30~19:00" } });
  const makerC = await prisma.classGroup.create({ data: { name: "메이커 C", campusId: bundang.id, teacher: "이수진", room: "Lab", schedule: "토 10:00~12:00" } });

  // ===== 학생 (출석 키오스크 phoneLast4) =====
  const st = (name: string, p: string, cg: string, points: number, balance: number, level: number, parent: string) =>
    prisma.student.create({ data: { name, phoneLast4: p, classGroupId: cg, campusId: bundang.id, points, balance, level, parentPhone: parent } });
  const minjun = await st("김민준", "1842", algoA.id, 620, 320, 3, "010-2345-1842");
  await st("이서연", "3074", algoA.id, 480, 200, 2, "010-8877-3074");
  await st("박하준", "5512", algoA.id, 310, 150, 2, "010-5566-5512");
  await st("최유나", "9201", algoA.id, 750, 400, 3, "010-1234-9201");
  await st("정도윤", "6688", algoA.id, 410, 180, 2, "010-9988-6688");
  await st("강지우", "7733", pythonB.id, 550, 260, 3, "010-4455-7733");
  await st("윤시우", "2211", pythonB.id, 200, 90, 1, "010-3322-2211");
  await st("한소율", "4456", makerC.id, 880, 500, 4, "010-7788-4456");

  // ===== LMS 커리큘럼 (11주) =====
  const cur = await prisma.curriculum.create({ data: { name: "코딩 사고력 11주 과정", totalWeeks: 11 } });
  const weeks = [
    [1, "프로그래밍이란?", "컴퓨터와 대화하기", 2], [2, "순서와 반복", "순서도 & 반복문", 3],
    [3, "조건문", "if/else 분기", 3], [4, "변수와 데이터", "정보를 담는 상자", 2],
    [5, "함수", "나만의 명령어", 3], [6, "리스트", "데이터 여러 개 다루기", 3],
    [7, "미니 프로젝트 1", "계산기 만들기", 4], [8, "파일 다루기", "파일 읽고 쓰기", 2],
    [9, "API 기초", "외부 데이터 가져오기", 3], [10, "최종 프로젝트", "나만의 앱 개발", 5],
    [11, "발표 & 회고", "프로젝트 발표", 1],
  ];
  for (const [week, theme, topic, missions] of weeks)
    await prisma.curriculumWeek.create({ data: { curriculumId: cur.id, week: week as number, theme: theme as string, topic: topic as string, missions: missions as number } });
  await prisma.progress.create({ data: { studentId: minjun.id, curriculumId: cur.id, currentWeek: 3 } });

  console.log("✅ 시드 완료: 캠퍼스 4, 사용자 7, 콘텐츠 7, 사용기록 9, 반 3, 학생 8, 커리큘럼 11주");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
