import { useLocation } from "react-router-dom";
import { gradeOptions, roleLabels } from "@zhixue/shared";
import Link from "@/components/link";
import { useAuth } from "@/auth/auth-provider";

export function StudentStudyBar({ pageName }: { pageName: string }) {
  const { pathname } = useLocation();
  const { user } = useAuth();

  if (pathname === "/") {
    return null;
  }

  const gradeLabel = user?.grade
    ? gradeOptions.find((g) => g.value === user.grade)?.label
    : undefined;

  return (
    <div className="shell-context wrap">
      <div className="shell-context-left">
        <Link href="/" className="mm-crumb-root">
          知学看板
        </Link>
        <span className="mm-crumb-sep">/</span>
        <span className="mm-crumb-current" aria-current="page">
          {pageName}
        </span>
        {user && (
          <span className="mm-role-chip">
            {gradeLabel ? `${gradeLabel} · ` : ""}
            {roleLabels[user.role]}
          </span>
        )}
      </div>

      <div className="shell-study-tools">
        <Link href="/trial" className="mm-context-link">
          试学与反馈
        </Link>
      </div>
    </div>
  );
}
