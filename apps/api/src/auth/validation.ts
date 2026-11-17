import { z } from "zod";
import { HttpError } from "../lib/http";
export const gradeCodes = ["G7", "G8", "G9", "G10", "G11", "G12"] as const;
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{4,32}$/, "账号需为4–32位小写字母、数字或下划线。");
const passphrase = z
  .string()
  .min(12, "密码至少12位。")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "密码的 UTF-8 长度不能超过72字节。",
  );
const displayName = z
  .string()
  .trim()
  .min(2, "昵称至少2个字符。")
  .max(20, "昵称最多20个字符。")
  .refine(
    (value) => !Array.from(value).some((c) => c.charCodeAt(0) < 32),
    "昵称包含无效字符。",
  );
export const registerSchema = z
  .object({ username, passphrase, displayName, grade: z.enum(gradeCodes) })
  .strict();
export const loginSchema = z
  .object({
    username,
    passphrase: z
      .string()
      .min(1)
      .max(200)
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        "密码长度无效。",
      ),
  })
  .strict();
export const profileSchema = z
  .object({ displayName, grade: z.enum(gradeCodes) })
  .strict();
export const passphraseSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: passphrase,
  })
  .strict();
export const recoverySchema = z
  .object({
    username,
    recoveryCode: z.string().regex(/^[a-f0-9]{64}$/),
    newPassword: passphrase,
  })
  .strict();
export const statusSchema = z
  .object({ status: z.enum(["ACTIVE", "DISABLED"]) })
  .strict();
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new HttpError(
      400,
      result.error.issues[0]?.message ?? "请检查填写内容。",
    );
  return result.data;
}
