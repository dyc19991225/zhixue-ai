import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../app";
import { getDb, disconnectDb } from "../lib/db";
import { disconnectRedis } from "../lib/rate-limiter";

test(
  "question search uses full DB pagination, literal keywords and public projection",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const db = getDb(),
      app = createApp(),
      prefix = "qa_search_" + randomUUID().slice(0, 8),
      ids: string[] = [];
    try {
      const rows = Array.from({ length: 20 }, (_, i) => ({
        id: randomUUID(),
        title: `${prefix} Study ${i}`,
        grade: "G7" as const,
        subject: "math",
        knowledgePoint: "synthetic search fixture",
        difficulty: "EASY" as const,
        options: ["1", "2", "3", "4"],
        answer: 0,
        explanation: "Never public",
        status:
          i === 16
            ? ("DRAFT" as const)
            : i === 17
              ? ("ARCHIVED" as const)
              : ("PUBLISHED" as const),
        restrictToLessons: i === 18,
      }));
      rows[19].title = `${prefix} special%_mark`;
      ids.push(...rows.map((row) => row.id));
      await db.question.createMany({ data: rows });
      const result = await request(app)
        .get("/api/practice/questions")
        .query({
          q: `${prefix.toUpperCase()} STUDY`,
          grade: "G7",
          subject: "math",
          page: 1,
        })
        .expect(200);
      assert.equal(result.body.data.total, 16);
      assert.equal(result.body.data.items.length, 12);
      const second = await request(app)
        .get("/api/practice/questions")
        .query({ q: `${prefix} Study`, page: 2 })
        .expect(200);
      assert.equal(second.body.data.items.length, 4);
      const all = [...result.body.data.items, ...second.body.data.items];
      assert.equal(new Set(all.map((row) => row.id)).size, 16);
      for (const row of all) {
        assert.equal(row.answer, undefined);
        assert.equal(row.explanation, undefined);
      }
      const literal = await request(app)
        .get("/api/practice/questions")
        .query({ q: `${prefix} special%_` })
        .expect(200);
      assert.equal(literal.body.data.total, 1);
      const otherGrade = await request(app)
        .get("/api/practice/questions")
        .query({ q: `${prefix} Study`, grade: "G8" })
        .expect(200);
      assert.equal(otherGrade.body.data.total, 0);
      for (const q of ["a", "x".repeat(121)])
        await request(app)
          .get("/api/practice/questions")
          .query({ q })
          .expect(400);
      await request(app)
        .get("/api/practice/questions")
        .query({ q: prefix, includeAnswers: true })
        .expect(400);
    } finally {
      await db.question.deleteMany({ where: { id: { in: ids } } });
      await disconnectDb();
      await disconnectRedis();
    }
  },
);
