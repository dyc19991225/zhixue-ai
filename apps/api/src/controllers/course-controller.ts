import type { RequestHandler } from "express";
import { HttpError, ok } from "../lib/http";
import { requireGrade } from "../services/catalog-service";
import {
  adminCoursePage,
  listPublishedCourses,
} from "../repositories/course-repository";
import type { CourseListQuery } from "../services/course-list.dto";
export const adminCoursesController: RequestHandler = async (
  _request,
  response,
) => {
  ok(response, await adminCoursePage(response.locals.input as CourseListQuery));
};
export const courseController: RequestHandler = async (request, response) => {
  const grade = requireGrade(request.query.grade);
  try {
    ok(response, {
      mode: "database",
      items: await listPublishedCourses(grade),
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "课程服务暂不可用，请稍后再试。");
  }
};
