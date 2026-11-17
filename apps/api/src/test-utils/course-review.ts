import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import type { Express } from "express";
import { register } from "../auth/service";
import { getDb } from "../lib/db";

export async function approveSyntheticCourse(
  app: Express,
  admin: Record<string, string>,
  courseId: string,
) {
  const db = getDb();
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
  assert.match(
    course.slug,
    /^qa[-_]/,
    "Only isolated synthetic courses may use this fixture",
  );
  const reviewer = await register({
    username: "qa_review_fixture_" + randomBytes(6).toString("hex"),
    passphrase: randomBytes(24).toString("hex"),
    displayName: "合成独立审核夹具",
    grade: "G7",
  });
  try {
    await db.user.update({
      where: { id: reviewer.user.id },
      data: { role: "ADMIN" },
    });
    const submitted = await request(app)
      .post(`/api/courses/${courseId}/reviews`)
      .set(admin)
      .send({ updatedAt: course.updatedAt.toISOString() })
      .expect(200);
    await request(app)
      .post(`/api/courses/${courseId}/reviews/decision`)
      .set({
        Authorization: `Bearer ${reviewer.accessToken}`,
        "X-Zhixue-Client": "web",
        Origin: "http://127.0.0.1:3000",
      })
      .send({
        reviewId: submitted.body.data.id,
        updatedAt: course.updatedAt.toISOString(),
        status: "APPROVED",
        feedback: "仅合成自动测试夹具，不是真实教研审核结论。",
        checks: {
          accuracy: true,
          alignment: true,
          rights: true,
          readability: true,
        },
      })
      .expect(200);
  } finally {
    await db.user.delete({ where: { id: reviewer.user.id } });
  }
}
