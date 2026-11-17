import type { RequestHandler } from "express";
import { authenticated } from "../../auth/middleware";
import { ok } from "../../lib/http";
import type { AnalyticsQuery, TrendQuery } from "./analytics.dto";
import * as service from "./analytics.service";
import { exportTrend } from "./analytics-export";
import { studentTasks, parentTasks } from "./study-tasks.service";
export const childTasks: RequestHandler = async (req, res) => {
  res.set("Cache-Control", "no-store");
  ok(
    res,
    await parentTasks(authenticated(req).user.id, String(req.params.studentId)),
  );
};
import { teacherTasks } from "./teacher-tasks.service";
export const teachingTasks: RequestHandler = async (req, res) => {
  res.set("Cache-Control", "no-store");
  ok(res, await teacherTasks(authenticated(req).user.id));
};
export const tasks: RequestHandler = async (req, res) => {
  res.set("Cache-Control", "no-store");
  ok(res, await studentTasks(authenticated(req).user.id));
};
export const exportMine: RequestHandler = async (req, res) => {
  res.set("Cache-Control", "no-store");
  ok(
    res,
    exportTrend(
      await service.studentTrend(
        authenticated(req).user.id,
        res.locals.input as TrendQuery,
      ),
    ),
  );
};
export const exportStudent: RequestHandler = async (req, res) => {
  res.set("Cache-Control", "no-store");
  ok(
    res,
    exportTrend(
      await service.studentTrend(
        authenticated(req).user.id,
        res.locals.input as TrendQuery,
        String(req.params.studentId),
      ),
    ),
  );
};
export const exportClass: RequestHandler = async (req, res) => {
  res.set("Cache-Control", "no-store");
  ok(
    res,
    exportTrend(
      await service.classTrend(
        authenticated(req).user.id,
        String(req.params.classId),
        res.locals.input as TrendQuery,
      ),
    ),
  );
};
export const myTrend: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.studentTrend(
      authenticated(req).user.id,
      res.locals.input as TrendQuery,
    ),
  );
};
export const studentTrend: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.studentTrend(
      authenticated(req).user.id,
      res.locals.input as TrendQuery,
      String(req.params.studentId),
    ),
  );
};
export const classTrend: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.classTrend(
      authenticated(req).user.id,
      String(req.params.classId),
      res.locals.input as TrendQuery,
    ),
  );
};
export const me: RequestHandler = async (req, res) => {
  ok(res, await service.studentAnalytics(authenticated(req).user.id));
};
export const student: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.studentAnalytics(
      authenticated(req).user.id,
      String(req.params.studentId),
    ),
  );
};
export const schoolClass: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.classAnalytics(
      authenticated(req).user.id,
      String(req.params.classId),
      res.locals.input as AnalyticsQuery,
    ),
  );
};
