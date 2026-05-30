// cwd에 의존하지 않도록 .env 로드와 경로를 절대경로로 고정 (어디서 실행해도 동작)
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // mms-platform/src
export const ROOT = path.resolve(__dirname, "..");              // mms-platform

dotenv.config({ path: path.join(ROOT, ".env") });

// SQLite 상대경로(file:./dev.db)를 schema 기준 절대경로로 변환
if (process.env.DATABASE_URL?.startsWith("file:")) {
  const rel = process.env.DATABASE_URL.slice(5);
  if (!path.isAbsolute(rel)) {
    process.env.DATABASE_URL = "file:" + path.join(ROOT, "prisma", rel.replace(/^\.?\//, ""));
  }
}

export const UPLOAD_DIR = path.join(ROOT, "uploads");
export const WEB_DIR = path.join(ROOT, "web");
