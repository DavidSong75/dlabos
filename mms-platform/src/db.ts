import "./config.js"; // .env + DATABASE_URL 절대경로화를 PrismaClient 생성 전에 수행
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
