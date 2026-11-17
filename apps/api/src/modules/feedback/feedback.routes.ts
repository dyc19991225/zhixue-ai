import { Router } from "express";
import { z } from "zod";
import {
  requireAuth,
  requireAdmin,
  requireSameOrigin,
  authenticated,
} from "../../auth/middleware";
import { parseInput } from "../../auth/validation";
import { limiter } from "../../lib/rate-limiter";
import { ok } from "../../lib/http";
import * as dto from "./feedback.dto";
import * as service from "./feedback.service";
export const feedbackRouter = Router();
feedbackRouter.get("/feedback", requireAuth, async (req, res) => {
  ok(
    res,
    await service.list(
      authenticated(req).user.id,
      parseInput(dto.listSchema, req.query),
    ),
  );
});
feedbackRouter.post(
  "/feedback",
  requireSameOrigin,
  requireAuth,
  limiter("feedback", 10, 3600000),
  async (req, res) => {
    ok(
      res,
      await service.submit(
        authenticated(req).user.id,
        parseInput(dto.submitSchema, req.body),
      ),
    );
  },
);
feedbackRouter.get(
  "/admin/feedback",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    ok(
      res,
      await service.list(undefined, parseInput(dto.listSchema, req.query)),
    );
  },
);
feedbackRouter.patch(
  "/admin/feedback/:id",
  requireSameOrigin,
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = parseInput(z.string().min(1).max(80), req.params.id);
    ok(
      res,
      await service.update(
        authenticated(req).user.id,
        id,
        parseInput(dto.updateSchema, req.body),
      ),
    );
  },
);
