/**
 * T249: PurchaseRepository for SQLite CRUD operations
 * Manages local purchase/tier status using singleton pattern (one row per DB).
 */
import { getDatabase } from '../database';
import { TierLevel } from '../../config/tiers';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PurchaseStatus {
  id: string; // always 'singleton'
  tier_level: TierLevel;
  product_id: string | null;
  purchase_token: string | null;
  purchased_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PurchaseStatusRow {
  id: string;
  tier_level: string;
  product_id: string | null;
  purchase_token: string | null;
  purchased_at: string | null;
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
 */
export const savePurchaseStatus = async (
  status: Pick<PurchaseStatus, 'tier_level' | 'product_id' | 'purchase_token' | 'purchased_at'>,
): Promise<PurchaseStatus> => {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO PurchaseStatus (id, tier_level, product_id, purchase_token, purchased_at, created_at, updated_at)
     VALUES ('singleton', ?, ?, ?, ?, COALESCE((SELECT created_at FROM PurchaseStatus WHERE id = 'singleton'), ?), ?)`,
    [
      status.tier_level,
      status.product_id ?? null,
      status.purchase_token ?? null,
      status.purchased_at ?? null,
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
