import { seedV2 } from './raw/seed_v2_tn10'

export const SEED_VERSION = '2026-04-28-russian-formula-coefficients-v1'

export async function runSeed(db) {
  await seedV2(db)

  await db.execute(
    `INSERT INTO app_meta (key, value, updated_at) VALUES ('seed_version', $1, CURRENT_TIMESTAMP)\n     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [SEED_VERSION]
  )
}
