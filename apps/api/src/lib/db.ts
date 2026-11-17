import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { HttpError } from "./http";
let db: PrismaClient | undefined;
export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new HttpError(503, "数据库尚未配置，正式课程暂不可用。");
  return (db ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }),
  }));
}
export async function disconnectDb() {
  await db?.$disconnect();
}
