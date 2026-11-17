import type { RequestHandler } from "express";
import { authenticated } from "../../auth/middleware";
import { ok } from "../../lib/http";
import type {
  HomeworkCreate,
  HomeworkGrade,
  HomeworkQuery,
  HomeworkStatusInput,
  HomeworkSubmit,
  HomeworkUpdate,
} from "./homework.dto";
import * as service from "./homework.service";
export const create: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.createHomework(
      authenticated(req).user.id,
      res.locals.input as HomeworkCreate,
    ),
  );
};
export const list: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.listHomework(
      authenticated(req).user.id,
      res.locals.input as HomeworkQuery,
    ),
  );
};
export const detail: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.homeworkDetail(
      authenticated(req).user.id,
      String(req.params.id),
    ),
  );
};
export const update: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.updateHomework(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as HomeworkUpdate,
    ),
  );
};
export const status: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.changeHomeworkStatus(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as HomeworkStatusInput,
    ),
  );
};
export const submit: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.submitHomework(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as HomeworkSubmit,
    ),
  );
};
export const submissions: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.listSubmissions(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as HomeworkQuery,
    ),
  );
};
export const grade: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.gradeHomework(
      authenticated(req).user.id,
      String(req.params.id),
      String(req.params.submissionId),
      res.locals.input as HomeworkGrade,
    ),
  );
};
