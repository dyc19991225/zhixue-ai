import type { RequestHandler } from "express";
import { authenticated } from "../../auth/middleware";
import { ok } from "../../lib/http";
import type {
  BankQuery,
  ExamCreate,
  ExamQuery,
  ExamStatusInput,
  ExamUpdate,
  ExamTemplate,
  SaveAnswers,
  SubmitExam,
} from "./exam.dto";
import * as service from "./exam.service";
export const previewTemplate: RequestHandler = (req, res) => {
  ok(res, service.previewTemplate(res.locals.input as ExamTemplate));
};
export const bank: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.bankOptions(
      authenticated(req).user.id,
      res.locals.input as BankQuery,
    ),
  );
};
export const create: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.createExam(
      authenticated(req).user.id,
      res.locals.input as ExamCreate,
    ),
  );
};
export const update: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.updateExam(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as ExamUpdate,
    ),
  );
};
export const list: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.listExams(
      authenticated(req).user.id,
      res.locals.input as ExamQuery,
    ),
  );
};
export const detail: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.examDetail(authenticated(req).user.id, String(req.params.id)),
  );
};
export const status: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.changeExamStatus(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as ExamStatusInput,
    ),
  );
};
export const start: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.startAttempt(
      authenticated(req).user.id,
      String(req.params.id),
    ),
  );
};
export const attempt: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.getAttempt(authenticated(req).user.id, String(req.params.id)),
  );
};
export const save: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.saveAnswers(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as SaveAnswers,
    ),
  );
};
export const submit: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.submitAttempt(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as SubmitExam,
    ),
  );
};
export const results: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.examResults(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as ExamQuery,
    ),
  );
};
