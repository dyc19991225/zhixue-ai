import type { RequestHandler } from "express";
import { ok } from "../lib/http";
import { getPreviewCatalog, requireGrade } from "../services/catalog-service";
export const catalogController: RequestHandler = (request, response) => {
  ok(response, getPreviewCatalog(requireGrade(request.query.grade)));
};
