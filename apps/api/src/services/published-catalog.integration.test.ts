import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { createApp } from "../app";
import { getDb, disconnectDb } from "../lib/db";
import type { PublishedCatalog } from "@zhixue/shared";

test(
  "public catalog: full pagination, metadata filters and published-only facets",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      app = createApp(),
      prefix = "qa_catalog_" + randomBytes(5).toString("hex");
    const ids = Array.from(
      { length: 108 },
      (_, i) => `${prefix}_${String(i).padStart(3, "0")}`,
    );
    const regionA = prefix + "地区甲",
      regionB = prefix + "地区乙",
      editionA = prefix + "版本甲",
      editionB = prefix + "版本乙";
    t.after(async () => {
      await db.course.deleteMany({ where: { id: { in: ids } } });
      await disconnectDb();
    });
    await db.course.createMany({
      data: ids.slice(0, 105).map((id, i) => ({
        id,
        slug: id.replaceAll("_", "-"),
        title: prefix + (i === 0 ? "MiXeD课程" : `课程${i}`),
        description: i === 1 ? "应用与检验KeyWord" : "合成说明",
        grade: "G12",
        subject: i === 2 ? "english" : "math",
        status: "PUBLISHED",
        region: i === 104 ? null : i === 2 ? regionB : regionA,
        textbookEdition: i === 104 ? null : i === 2 ? editionB : editionA,
        term: i === 104 ? null : i === 1 ? "下学期" : "上学期",
        access: i === 1 ? "MEMBER" : "FREE",
        updatedAt: new Date("2010-01-01T00:00:00Z"),
      })),
    });
    for (const [index, status, grade] of [
      [105, "DRAFT", "G12"],
      [106, "ARCHIVED", "G12"],
      [107, "PUBLISHED", "G11"],
    ] as const) {
      await db.course.create({
        data: {
          id: ids[index],
          slug: ids[index].replaceAll("_", "-"),
          title: prefix + "隐藏课程",
          grade,
          subject: "math",
          status,
          region: prefix + "不可见地区" + index,
          textbookEdition: prefix + "不可见版本" + index,
          term: prefix + "不可见学期" + index,
        },
      });
    }
    await db.chapter.create({
      data: {
        courseId: ids[0],
        title: "目录章",
        position: 0,
        lessons: {
          create: {
            title: "目录课时",
            content: "不应从公开目录返回的正文",
            publishedAt: new Date(),
            position: 0,
          },
        },
      },
    });
    async function catalog(filters: Record<string, string | number> = {}) {
      const r = await request(app)
        .get("/api/published-courses")
        .query({ grade: "G12", q: prefix, ...filters });
      assert.equal(r.status, 200);
      return r.body.data as PublishedCatalog;
    }
    await t.test(
      "queries all matching courses instead of searching a truncated hundred",
      async () => {
        const first = await catalog({ pageSize: 100 }),
          second = await catalog({ page: 2, pageSize: 100 });
        assert.equal(first.total, 105);
        assert.equal(first.items.length, 100);
        assert.equal(second.total, 105);
        assert.deepEqual(
          second.items.map((c) => c.id),
          ids.slice(100, 105),
        );
        assert.equal(first.subjectCounts.math, 104);
        assert.equal(first.subjectCounts.english, 1);
        const found = await catalog({ q: prefix + "课程103" });
        assert.deepEqual(
          found.items.map((c) => c.id),
          [ids[103]],
        );
        assert.equal(
          (await catalog({ page: 10000, pageSize: 9 })).items.length,
          0,
        );
      },
    );
    await t.test(
      "combines exact metadata, subject and membership filters",
      async () => {
        const r = await catalog({
          region: regionA,
          textbookEdition: editionA,
          term: "上学期",
          access: "FREE",
          subject: "math",
        });
        assert.equal(r.total, 102);
        assert.equal(r.subjectCounts.math, 102);
        assert.equal(
          (await catalog({ region: regionA, access: "MEMBER" })).total,
          1,
        );
        assert.deepEqual(
          (await catalog({ subject: "english" })).items.map((c) => c.id),
          [ids[2]],
        );
        assert.equal(
          (await catalog({ region: regionB, textbookEdition: editionA })).total,
          0,
        );
      },
    );
    await t.test(
      "search supports Chinese subject names, title case and descriptions",
      async () => {
        assert.equal(
          (await catalog({ q: "数学", region: regionA })).total,
          103,
        );
        assert.deepEqual(
          (await catalog({ q: "mixed", region: regionA })).items.map(
            (c) => c.id,
          ),
          [ids[0]],
        );
        assert.deepEqual(
          (await catalog({ q: "keyword", region: regionA })).items.map(
            (c) => c.id,
          ),
          [ids[1]],
        );
      },
    );
    await t.test(
      "facets use only published courses in selected grade, independent of narrowing filters",
      async () => {
        const r = await catalog({ subject: "english", region: regionA });
        assert.equal(r.total, 0);
        assert.equal(r.subjectCounts.math, 103);
        assert.ok(r.facets.regions.includes(regionA));
        assert.ok(r.facets.regions.includes(regionB));
        assert.ok(r.facets.textbookEditions.includes(editionA));
        assert.ok(r.facets.textbookEditions.includes(editionB));
        for (const values of Object.values(r.facets)) {
          assert.equal(
            values.some((value) => !value.trim()),
            false,
          );
          assert.equal(
            values.some((value) => value.includes("不可见")),
            false,
          );
        }
      },
    );
    await t.test(
      "public metadata excludes draft courses, lesson content and server fields",
      async () => {
        const r = await catalog({ pageSize: 100 });
        assert.equal(
          r.items.some((c) => c.status !== "PUBLISHED"),
          false,
        );
        assert.equal(
          JSON.stringify(r).includes("不应从公开目录返回的正文"),
          false,
        );
        assert.equal("ownerTeacherId" in r.items[0], false);
        assert.deepEqual(
          Object.keys(r.items[0].chapters[0].lessons[0]).sort(),
          ["id", "position", "title"],
        );
        const legacy = await request(app).get(
          "/api/published-courses?grade=G12&subject=math",
        );
        assert.equal(legacy.status, 200);
        assert.ok(Array.isArray(legacy.body.data.items));
      },
    );
    await t.test(
      "invalid and unknown query parameters cannot widen visibility",
      async () => {
        for (const filters of [
          { page: 0 },
          { pageSize: 101 },
          { grade: "G99" },
          { access: "ALL" },
          { status: "DRAFT" },
          { q: "x".repeat(121) },
          { region: [regionA, regionB] },
        ]) {
          const r = await request(app)
            .get("/api/published-courses")
            .query(filters);
          assert.equal(r.status, 400);
          assert.equal(r.body.data, null);
        }
      },
    );
  },
);
