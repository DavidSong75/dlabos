import { UPLOAD_DIR, WEB_DIR } from "./config.js";
import express from "express";
import cors from "cors";
import path from "node:path";
import { attachUser } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { contentsRouter } from "./routes/contents.js";
import { usageRouter } from "./routes/usage.js";
import { settlementRouter } from "./routes/settlement.js";
import { attendanceRouter } from "./routes/attendance.js";
import { studentsRouter } from "./routes/students.js";
import { paymentsRouter } from "./routes/payments.js";
import { notificationsRouter } from "./routes/notifications.js";
import { lmsRouter } from "./routes/lms.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(attachUser);

// 헬스 체크
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "dlab-mms" }));

// API
app.use("/api/auth", authRouter);
app.use("/api/contents", contentsRouter);
app.use("/api/usage", usageRouter);
app.use("/api/settlement", settlementRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/students", studentsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/lms", lmsRouter);

// 업로드 파일 정적 제공
app.use("/uploads", express.static(UPLOAD_DIR));

// 프론트엔드(정적) — web/ 폴더
app.use(express.static(WEB_DIR));
app.get("*", (_req, res) => res.sendFile(path.join(WEB_DIR, "index.html")));

// 에러 핸들러
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`✅ D.LAB MMS 서버: http://localhost:${PORT}`));
