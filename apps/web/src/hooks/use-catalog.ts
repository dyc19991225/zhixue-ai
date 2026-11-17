import { useEffect, useState } from "react";
import {
  subjectsForGrade,
  type Grade,
  type CatalogData,
  type ApiResponse,
} from "@zhixue/shared";
export function useCatalog(grade: Grade) {
  const [result, setResult] = useState<CatalogData>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch(`/api/catalog?grade=${encodeURIComponent(grade)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("catalog unavailable");
        const body = (await response.json()) as ApiResponse<CatalogData>;
        if (
          body.code !== 0 ||
          body.data.mode !== "preview" ||
          body.data.grade !== grade ||
          !Array.isArray(body.data.subjects)
        )
          throw new Error("invalid catalog response");
        setResult(body.data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [grade]);
  return {
    subjects:
      result?.grade === grade ? result.subjects : subjectsForGrade(grade),
    failed,
  };
}
