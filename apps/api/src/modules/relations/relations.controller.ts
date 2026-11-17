import type { RequestHandler } from "express";
import { authenticated } from "../../auth/middleware";
import { ok } from "../../lib/http";
import type {
  TeacherRevision,
  ClassCreate,
  ParentLinkInput,
  ParentLinksQuery,
  RelationPageQuery,
  TeacherAssignment,
} from "./relations.dto";
export const reviseTeacherCourse: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.reviseTeacherCourse(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as TeacherRevision,
    ),
  );
};
import * as service from "./relations.service";
export const parentLinks: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.parentLinks(
      authenticated(req).user.id,
      res.locals.input as ParentLinksQuery,
    ),
  );
};
export const addMemberByUsername: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.addMemberByUsername(
      authenticated(req).user.id,
      String(req.params.id),
      (res.locals.input as { username: string }).username,
    ),
  );
};

export const assignTeacher: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.assignTeacher(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as TeacherAssignment,
    ),
  );
};
export const teacherCourses: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.teacherCourses(
      authenticated(req).user.id,
      res.locals.input as RelationPageQuery,
    ),
  );
};
export const teacherCourse: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.teacherCourse(
      authenticated(req).user.id,
      String(req.params.id),
    ),
  );
};
export const createClass: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.createClass(
      authenticated(req).user.id,
      res.locals.input as ClassCreate,
    ),
  );
};
export const classes: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.classes(
      authenticated(req).user.id,
      res.locals.input as RelationPageQuery,
    ),
  );
};
export const roster: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.roster(
      authenticated(req).user.id,
      String(req.params.id),
      res.locals.input as RelationPageQuery,
    ),
  );
};
export const addMember: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.changeMember(
      authenticated(req).user.id,
      String(req.params.id),
      String(req.params.studentId),
      true,
    ),
  );
};
export const removeMember: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.changeMember(
      authenticated(req).user.id,
      String(req.params.id),
      String(req.params.studentId),
      false,
    ),
  );
};
export const archiveClass: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.archiveClass(
      authenticated(req).user.id,
      String(req.params.id),
    ),
  );
};
export const bindParent: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.changeParentLink(
      authenticated(req).user.id,
      res.locals.input as ParentLinkInput,
      true,
    ),
  );
};
export const unbindParent: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.changeParentLink(
      authenticated(req).user.id,
      {
        parentId: String(req.params.parentId),
        studentId: String(req.params.studentId),
      },
      false,
    ),
  );
};
export const children: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.children(
      authenticated(req).user.id,
      res.locals.input as RelationPageQuery,
    ),
  );
};
export const childOverview: RequestHandler = async (req, res) => {
  ok(
    res,
    await service.childOverview(
      authenticated(req).user.id,
      String(req.params.studentId),
    ),
  );
};
