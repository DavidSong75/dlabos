// AI 수업 요약 stub — 실제 STT/LLM 연동 자리. 지금은 녹취 텍스트로 템플릿 요약 생성.
// 실제 연동 시 summarizeLesson() 본문을 LLM 호출로 교체.
export function summarizeLesson(transcript: string, opts: { students?: string[] } = {}) {
  const lines = transcript.split("\n").map((l) => l.trim()).filter(Boolean);
  const questions = lines.filter((l) => l.includes("?") || l.includes("어떻게") || l.includes("왜")).length;
  const students = opts.students ?? [];
  const perStudent = students.map((name) => ({
    name,
    participation: 3 + (name.length % 3), // stub 점수
    note: `${name} 학생은 질문과 발표에 적극적으로 참여했습니다.`,
  }));
  const summary =
    `오늘 수업에서는 핵심 개념을 다루고 미션을 수행했습니다. ` +
    `총 ${lines.length}개의 상호작용, 질문 ${questions}회가 기록되었습니다. ` +
    `학생들은 전반적으로 높은 참여도를 보였습니다.`;
  return { summary, questions, interactions: lines.length, perStudent };
}
