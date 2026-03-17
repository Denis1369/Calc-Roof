import { seedV2 } from './raw/seed_v2_tn10'

export async function runSeed(db) {
  await seedV2(db)
}