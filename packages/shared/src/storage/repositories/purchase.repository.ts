/**
 * T249 + T262: PurchaseRepository for SQLite CRUD operations
 * Manages local purchase/tier status using singleton pattern (one row per DB).
 * T262: Extended with subscription fields (subscription_type, expiry_date, auto_renewing).
 */
import { getDatabase } from '../database';
import { TierLevel } from '../../config/tiers';
import type { SubscriptionPlan } from '../../services/billing.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PurchaseStatus {
  id: string; // always 'singleton'
  tier_level: TierLevel;
  product_id: string | null;
  purchase_token: string | null;
  purchased_at: string | null;
  subscription_type: SubscriptionPlan | null; // T262
  expiry_date: string | null; // T262: ISO 8601
  auto_renewing: boolean; // T262
  created_at: string;
  updated_at: string;
}

interface PurchaseStatusRow {
  id: string;
  tier_level: string;
  product_id: string | null;
  purchase_token: string | null;
  purchased_at: string | null;
  subscription_type: string | null;
  expiry_date: string | null;
  auto_renewing: number | null; // SQLite stores booleans as 0/1
  created_at: string;
  updated_at: string;
}

// ─── Converters ───────────────────────────────────────────────────────────────

const rowToPurchaseStatus = (row: PurchaseStatusRow): PurchaseStatus => ({
  id: row.id,
  tier_level: row.tier_level as TierLevel,
  product_id: row.product_id,
  purchase_token: row.purchase_token,
  purchased_at: row.purchased_at,
  subscription_type: (row.subscription_type as SubscriptionPlan) ?? null,
  expiry_date: row.expiry_date ?? null,
  auto_renewing: row.auto_renewing === 1,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// ─── Repository Methods ───────────────────────────────────────────────────────

/**
 * Get the current purchase status (singleton pattern).
 * Returns null if no purchase record exists yet (user is implicitly FREE).
 */
export const getPurchaseStatus = async (): Promise<PurchaseStatus | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PurchaseStatusRow>(
    "SELECT * FROM PurchaseStatus WHERE id = 'singleton' LIMIT 1",
  );
  return row ? rowToPurchaseStatus(row) : null;
};

/**
 * Save or update the purchase status.
 * Uses INSERT OR REPLACE to handle both create and update.
 * T262: Extended to persist subscription_type, expiry_date, auto_renewing.
 */
export const savePurchaseStatus = async (
  status: Pick<
    PurchaseStatus,
    | 'tier_level'
    | 'product_id'
    | 'purchase_token'
    | 'purchased_at'
    | 'subscription_type'
    | 'expiry_date'
    | 'auto_renewing'
  >,
): Promise<PurchaseStatus> => {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO PurchaseStatus
       (id, tier_level, product_id, purchase_token, purchased_at,
        subscription_type, expiry_date, auto_renewing,
        created_at, updated_at)
     VALUES ('singleton', ?, ?, ?, ?, ?, ?, ?,
       COALESCE((SELECT created_at FROM PurchaseStatus WHERE id = 'singleton'), ?), ?)`,
    [
      status.tier_level,
      status.product_id ?? null,
      status.purchase_token ?? null,
      status.purchased_at ?? null,
      status.subscription_type ?? null,
      status.expiry_date ?? null,
      status.auto_renewing ? 1 : 0,
      now,
      now,
    ],
  );

  const saved = await getPurchaseStatus();
  if (!saved) {
    throw new Error('Failed to save purchase status');
  }
  return saved;
};

/**
 * Clear the purchase status (reset to FREE tier).
 * Used on purchase reversal or manual reset.
 */
export const clearPurchaseStatus = async (): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM PurchaseStatus WHERE id = 'singleton'");
};
