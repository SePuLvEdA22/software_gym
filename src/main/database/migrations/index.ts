import type { Migration } from './types'
import { m001InitialSchema } from './001-initial-schema'
import { m002AddFrozenAt } from './002-add-frozen-at'
import { m003AddDiscountToPayments } from './003-add-discount-to-payments'
import { m004AddFreezeReasonAndDays } from './004-add-freeze-reason-and-days'
import { m005AddPromotionsTable } from './005-add-promotions-table'
import { m006SeedDefaultData } from './006-seed-default-data'
import { m007AddUsersAndChangeLog } from './007-add-users-and-change-log'
import { m008MigratePhotosToFiles } from './008-migrate-photos-to-files'
import { m009AddRoutinesAndGymSettings } from './009-add-routines-and-gym-settings'
import { m010UpdateWelcomeMessage } from './010-update-welcome-message'
import { m011ForcePasswordChange } from './011-force-password-change'
import { m012AddIndexesAndThumbnails } from './012-add-indexes-and-thumbnails'
import { m013BackfillUserPermissions } from './013-backfill-user-permissions'
import { m014FreezeHistoryUnfrozenBy } from './014-freeze-history-unfrozen-by'
import { m015CleanOrphanClientData } from './015-clean-orphan-client-data'

/**
 * Registro central de migraciones. El orden del array define el orden de
 * aplicación; una migración nueva se añade SIEMPRE al final con un nombre
 * nuevo (los nombres son permanentes en la tabla `_migrations`).
 */
export const MIGRATIONS: Migration[] = [
  m001InitialSchema,
  m002AddFrozenAt,
  m003AddDiscountToPayments,
  m004AddFreezeReasonAndDays,
  m005AddPromotionsTable,
  m006SeedDefaultData,
  m007AddUsersAndChangeLog,
  m008MigratePhotosToFiles,
  m009AddRoutinesAndGymSettings,
  m010UpdateWelcomeMessage,
  m011ForcePasswordChange,
  m012AddIndexesAndThumbnails,
  m013BackfillUserPermissions,
  m014FreezeHistoryUnfrozenBy,
  m015CleanOrphanClientData
]
