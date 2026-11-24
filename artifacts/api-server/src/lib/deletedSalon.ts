import { barbersTable } from "@workspace/db";
import { sql } from "drizzle-orm";

export const DELETED_SALON_NAME = "Salon supprimé";
export const DELETED_SALON_REASON = "Compte supprimé";

// A normal suspension is not an account deletion; nullable reasons are common.
export const notDeletedSalon = sql`not (
  ${barbersTable.status} = 'suspended'
  and ${barbersTable.salonName} = ${DELETED_SALON_NAME}
  and ${barbersTable.suspensionReason} is not distinct from ${DELETED_SALON_REASON}
)`;
