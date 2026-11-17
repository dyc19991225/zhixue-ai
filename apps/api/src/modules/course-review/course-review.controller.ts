import type { RequestHandler } from "express";
import { authenticated } from "../../auth/middleware";
import { ok } from "../../lib/http";
import * as service from "./course-review.service";
import type { ReviewDecision, ReviewSubmit } from "./course-review.dto";
export const queue: RequestHandler = async (req, res) => {
  const query = res.locals.input as { page: number; pageSize: number };
  res.set("Cache-Control", "no-store");
  ok(
    res,
    await service.reviewQueue(
      authenticated(req).user.id,
      query.page,
      query.pageSize,
    ),
  );
};
export const list: RequestHandler = async (req, res) => {
  const query = res.locals.input as { page: number; pageSize: number };
  ok(
    res,
    await service.reviews(
      authenticated(req).user.id,
      String(req.params.id),
      query.page,
      query.pageSize,
    ),
  );
};
export const submit: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.submitReview(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as ReviewSubmit,
    ),
  );
};
export const decide: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.decideReview(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as ReviewDecision,
    ),
  );
};
export const status: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.changeCourseStatus(
      authenticated(req).user.id,
      String(req.params.id),
      (res.locals.input as { status: "DRAFT" | "PUBLISHED" | "ARCHIVED" })
        .status,
    ),
  );
};
