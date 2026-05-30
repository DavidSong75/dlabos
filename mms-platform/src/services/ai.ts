// AI 수업 요약 — 실연동(LLM) + stub 폴백.
// ANTHROPIC_API_KEY 가 있으면 실제 Claude API를 호출하고, 없으면 템플릿 stub을 사용.
export interface LessonSummary {
  summary: string;
  questions: number;
  interactions: number;
  perStudent: { name: string; participation: number; note: string }[];
  mode: "live" | "stub";
}

export async function summarizeLesson(transcript: string, opts: { students?: string[] } = {}): Promise<LessonSummary> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await liveLLM(transcript, opts);
    } catch (e) {
      console.error("[AI] LLM 호출 실패 → stub 폴백:", (e as Error).message);
    }
  }
  return stubSummary(transcript, opts);
}

async function liveLLM(transcript: string, opts: { students?: string[] }): Promise<LessonSummary> {
  const students = opts.students ?? [];
  const prompt =
    `다음은 코딩 학원 수업 녹취입니다. 한국어로 3문장 이내 요약하고, 학생별 참여를 1~5점으로 평가하세요.\n` +
    `학생: ${students.join(", ") || "(미지정)"}\n응답은 JSON {"summary":string,"perStudent":[{"name","participation","note"}]} 형식만.\n\n녹취:\n${transcript}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error("LLM HTTP " + res.status);
  const j: any = await res.json();
  const text = j.content?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  const lines = transcript.split("\n").filter((l) => l.trim());
  return {
    summary: parsed.summary ?? "",
    questions: lines.filter((l) => l.includes("?")).length,
    interactions: lines.length,
    perStudent: parsed.perStudent ?? students.map((name) => ({ name, participation: 4, note: "" })),
    mode: "live",
  };
}

function stubSummary(transcript: string, opts: { students?: string[] }): LessonSummary {
  const lines = transcript.split("\n").map((l) => l.trim()).filter(Boolean);
  const questions = lines.filter((l) => l.includes("?") || l.includes("어떻게") || l.includes("왜")).length;
  const students = opts.students ?? [];
  return {
    summary:
      `오늘 수업에서는 핵심 개념을 다루고 미션을 수행했습니다. ` +
      `총 ${lines.length}개의 상호작용, 질문 ${questions}회가 기록되었습니다. 학생들은 전반적으로 높은 참여도를 보였습니다.`,
    questions,
    interactions: lines.length,
    perStudent: students.map((name) => ({ name, participation: 3 + (name.length % 3), note: `${name} 학생은 질문·발표에 적극 참여했습니다.` })),
    mode: "stub",
  };
}
