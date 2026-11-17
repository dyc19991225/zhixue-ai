import type { Prisma } from "../../generated/prisma/client";
import type { Role } from "@zhixue/shared";
export type RelationTransaction = Prisma.TransactionClient;
export type RelationActor = { id: string; role: Role };
