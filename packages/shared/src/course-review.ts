export type CourseReviewChecks = {
  accuracy: true;
  alignment: true;
  rights: true;
  readability: true;
};
export type CourseReviewQueue = {
  page: number;
  pageSize: number;
  total: number;
  list: {
    courseId: string;
    reviewId: string;
    title: string;
    submittedByName: string;
    submittedAt: string;
    versionCurrent: boolean;
    submittedBySelf: boolean;
    canDecide: boolean;
  }[];
};
export type CourseReviewSnapshot = {
  title: string;
  slug: string;
  grade: string;
  subject: string;
  access: string;
  description: string | null;
  region: string | null;
  textbookEdition: string | null;
  term: string | null;
  chapters: {
    id: string;
    title: string;
    position: number;
    lessons: {
      id: string;
      title: string;
      content: string | null;
      mediaId: string | null;
      position: number;
    }[];
  }[];
};
export type CourseReviewRecord = {
  id: string;
  contentHash: string;
  status: "PENDING" | "APPROVED" | "RETURNED";
  submittedById: string;
  submittedByName: string;
  submittedAt: string;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  feedback: string | null;
  checks: CourseReviewChecks | null;
  snapshot: CourseReviewSnapshot;
};
export type CourseReviewPage = {
  page: number;
  pageSize: number;
  total: number;
  list: CourseReviewRecord[];
  current: {
    state: "NOT_SUBMITTED" | "STALE" | CourseReviewRecord["status"];
    updatedAt: string;
    contentHash: string;
    courseStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    snapshot: CourseReviewSnapshot;
    latest: CourseReviewRecord | null;
  };
};
export type CourseReviewDecision = {
  reviewId: string;
  updatedAt: string;
  feedback: string;
} & (
  { status: "APPROVED"; checks: CourseReviewChecks } | { status: "RETURNED" }
);
