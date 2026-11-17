import type { Prisma } from "../../generated/prisma/client";
import type { QuestionDiagram } from "@zhixue/shared";
export type ExamTransaction = Prisma.TransactionClient;
export type PaperQuestion = {
  title: string;
  options: string[];
  answer: number;
  explanation: string;
  points: number;
  diagram?: QuestionDiagram | null;
  sourceQuestionId?: string;
};
