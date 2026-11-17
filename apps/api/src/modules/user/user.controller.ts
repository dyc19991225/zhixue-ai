import type { RequestHandler } from "express";
import { authenticated } from "../../auth/middleware";
import { ok } from "../../lib/http";
import type { RoleUpdate } from "./user.dto";
import { changeUserRole } from "./user.service";
import { userRepository } from "./user.repository";
import type { UserOptionsQuery } from "./user.dto";
export const userOptionsController: RequestHandler = async (
  _request,
  response,
) => {
  ok(
    response,
    await userRepository.options(response.locals.input as UserOptionsQuery),
  );
};

export const changeRoleController: RequestHandler = async (
  request,
  response,
) => {
  ok(
    response,
    await changeUserRole(
      authenticated(request).user.id,
      String(request.params.id),
      response.locals.input as RoleUpdate,
    ),
  );
};
