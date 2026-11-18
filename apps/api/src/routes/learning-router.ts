import { Router } from "express";
import { adminCoursesController } from "../controllers/course-controller";
import { validate } from "../middleware/validate";
import { courseListSchema } from "../services/course-list.dto";
import { z } from "zod";
import { questionPage, wrongPage } from "../repositories/practice-repository";
import { pageSchema, wrongQuerySchema } from "../services/practice-validation";
import {
  requireCourseEntitlement,
  hasMembership,
} from "../services/entitlement-service";
import { getDb } from "../lib/db";
import { HttpError, ok } from "../lib/http";
import {
  authenticated,
  requireAuth,
  requireAdmin,
  rbac,
  requireSameOrigin,
} from "../auth/middleware";
import { parseInput } from "../auth/validation";
import {
  learningLibrary,
  learningLibrarySchema,
} from "../services/learning-library";
import {
  learning,
  publishedCourse,
  saveCourse,
} from "../services/learning-service";
import { courseStatusSchema } from "../modules/course-review/course-review.dto";
import { status as changeStatus } from "../modules/course-review/course-review.controller";
import {
  publishedCatalog,
  publishedCatalogSchema,
} from "../services/published-catalog";
import {
  learningReviewNext,
  learningReviewNextSchema,
  learningReviewQueue,
  learningReviewQueueSchema,
} from "../services/learning-review-queue";
export const learningRouter = Router();
learningRouter.get(
  "/learning-review-queue",
  requireAuth,
  rbac(["STUDENT"]),
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    ok(
      res,
      await learningReviewQueue(
        authenticated(req).user.id,
        parseInput(learningReviewQueueSchema, req.query),
      ),
    );
  },
);
learningRouter.get("/learning-library", requireAuth, async (req, res) => {
  res.set("Cache-Control", "no-store");
  ok(
    res,
    await learningLibrary(
      authenticated(req).user.id,
      parseInput(learningLibrarySchema, req.query),
    ),
  );
});
learningRouter.get(
  "/learning-review-queue/next",
  requireAuth,
  rbac(["STUDENT"]),
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    ok(
      res,
      await learningReviewNext(
        authenticated(req).user.id,
        parseInput(learningReviewNextSchema, req.query),
      ),
    );
  },
);
async function lessonPracticeScope(
  userId: string,
  courseId: string,
  lessonId: string,
) {
  const { course } = await learning(userId, courseId);
  const openLesson = {
    id: lessonId,
    publishedAt: { not: null },
    chapter: { courseId, course: { status: "PUBLISHED" as const } },
  };
  const lesson = await getDb().lesson.findFirst({
    where: openLesson,
    select: { title: true },
  });
  if (!lesson) throw new HttpError(404, "课时不属于该课程或尚未开放。");
  return {
    context: {
      title: lesson.title,
      courseTitle: course.title,
      grade: course.grade,
      subject: course.subject,
    },
    where: {
      status: "PUBLISHED" as const,
      lessonLinks: { some: { lessonId, lesson: openLesson } },
    },
  };
}

learningRouter.get(
  "/learning/:id/lessons/:lessonId/questions",
  requireAuth,
  async (req, res) => {
    const { page } = parseInput(pageSchema, req.query);
    const scope = await lessonPracticeScope(
      authenticated(req).user.id,
      String(req.params.id),
      String(req.params.lessonId),
    );
    res.set("Cache-Control", "no-store");
    ok(res, {
      ...(await questionPage(scope.where, page)),
      lesson: scope.context,
    });
  },
);

learningRouter.get(
  "/learning/:id/lessons/:lessonId/wrong-questions",
  requireAuth,
  async (req, res) => {
    const { page, state } = parseInput(
      wrongQuerySchema.pick({ page: true, state: true }),
      req.query,
    );
    const userId = authenticated(req).user.id;
    const scope = await lessonPracticeScope(
      userId,
      String(req.params.id),
      String(req.params.lessonId),
    );
    const result = await wrongPage(
      userId,
      {
        resolvedAt: state === "active" ? null : { not: null },
        question: scope.where,
      },
      page,
    );
    res.set("Cache-Control", "no-store");
    ok(res, { ...result, lesson: scope.context });
  },
);
learningRouter.get(
  "/admin/lesson-options",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { includeId } = parseInput(
      z.object({ includeId: z.string().min(1).max(100).optional() }).strict(),
      req.query,
    );
    const select = {
      id: true,
      title: true,
      chapter: { select: { title: true, course: { select: { title: true } } } },
    } as const;
    const items = await getDb().lesson.findMany({
      take: 300,
      orderBy: { id: "asc" },
      select,
    });
    if (includeId && !items.some((item) => item.id === includeId)) {
      const pinned = await getDb().lesson.findUnique({
        where: { id: includeId },
        select,
      });
      if (pinned) items.push(pinned);
    }
    ok(res, {
      items,
    });
  },
);
const admin = [requireAuth, requireAdmin];
const write = [requireSameOrigin, ...admin];
learningRouter.get("/published-courses", async (req, res) => {
  ok(
    res,
    await publishedCatalog(parseInput(publishedCatalogSchema, req.query)),
  );
});
learningRouter.get("/course/:id", async (req, res) =>
  ok(res, await publishedCourse(String(req.params.id))),
);
learningRouter.get(
  "/admin/courses",
  ...admin,
  validate(courseListSchema, "query"),
  adminCoursesController,
);
learningRouter.get("/admin/courses/:id", ...admin, async (req, res) => {
  const course = await getDb().course.findUnique({
    where: { id: String(req.params.id) },
    include: {
      chapters: {
        orderBy: { position: "asc" },
        include: { lessons: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!course) throw new HttpError(404, "课程不存在。");
  ok(res, course);
});
learningRouter.post("/admin/courses", ...write, async (req, res) =>
  ok(res, await saveCourse(null, req.body)),
);
learningRouter.put("/admin/courses/:id", ...write, async (req, res) =>
  ok(res, await saveCourse(String(req.params.id), req.body)),
);
learningRouter.patch(
  "/admin/courses/:id/status",
  ...write,
  validate(courseStatusSchema),
  changeStatus,
);
learningRouter.post(
  "/course/:id/enroll",
  requireSameOrigin,
  requireAuth,
  async (req, res) => {
    const course = await publishedCourse(String(req.params.id));
    const userId = authenticated(req).user.id;
    await requireCourseEntitlement(userId, course.access);
    const result = await getDb().enrollment.upsert({
      where: { userId_courseId: { userId, courseId: course.id } },
      create: { userId, courseId: course.id },
      update: {},
    });
    ok(res, { id: result.id });
  },
);
learningRouter.get("/learning", requireAuth, async (req, res) => {
  const items = await getDb().enrollment.findMany({
    where: {
      userId: authenticated(req).user.id,
      course: {
        status: "PUBLISHED",
        ...((await hasMembership(authenticated(req).user.id))
          ? {}
          : { access: "FREE" as const }),
      },
    },
    select: { courseId: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  ok(res, {
    items: await Promise.all(
      items.map((item) => learning(authenticated(req).user.id, item.courseId)),
    ),
  });
});
learningRouter.get("/learning/:id", requireAuth, async (req, res) =>
  ok(res, await learning(authenticated(req).user.id, String(req.params.id))),
);
learningRouter.get(
  "/learning/:id/lessons/:lessonId",
  requireAuth,
  async (req, res) => {
    await learning(authenticated(req).user.id, String(req.params.id));
    const lesson = await getDb().lesson.findFirst({
      where: {
        id: String(req.params.lessonId),
        chapter: {
          courseId: String(req.params.id),
          course: { status: "PUBLISHED" },
        },
        publishedAt: { not: null },
      },
    });
    if (!lesson) throw new HttpError(404, "课时不存在或尚未开放。");
    ok(res, {
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      hasVideo: !!lesson.mediaId,
    });
  },
);
learningRouter.put(
  "/learning/:id/lessons/:lessonId/completion",
  requireSameOrigin,
  requireAuth,
  async (req, res) => {
    const userId = authenticated(req).user.id,
      courseId = String(req.params.id),
      lessonId = String(req.params.lessonId);
    parseInput(z.object({}).strict(), req.body);
    await learning(userId, courseId);
    const lesson = await getDb().lesson.findFirst({
      where: {
        id: lessonId,
        publishedAt: { not: null },
        chapter: { courseId, course: { status: "PUBLISHED" } },
      },
    });
    if (!lesson) throw new HttpError(404, "课时不属于该课程或尚未开放。");
    const enrollment = await getDb().enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId, courseId } },
    });
    const result = await getDb().$transaction(async (tx) => {
      const where = {
        enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
      };
      await tx.lessonProgress.upsert({
        where,
        create: {
          enrollmentId: enrollment.id,
          lessonId,
          completedAt: new Date(),
        },
        update: {},
      });
      // Only set the first completion timestamp; retain video position on retries.
      await tx.lessonProgress.updateMany({
        where: { enrollmentId: enrollment.id, lessonId, completedAt: null },
        data: { completedAt: new Date() },
      });
      return tx.lessonProgress.findUniqueOrThrow({ where });
    });
    ok(res, { lessonId, completedAt: result.completedAt });
  },
);
