/**
 * T141: Sync Status Indicator Component
 *
 * Displays current cloud sync status:
 * - "Syncing..." with spinner when actively syncing
 * - "✓ Synced at TIME" when last sync was successful
 * - "⚠ Pending N items" with retry button when items are queued
 * - Nothing when user is not signed in
 */
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Cloud, RefreshCw, AlertTriangle, Check } from 'lucide-react-native';
import { useExamStore } from '../stores/exam.store';
import { useAuthStore } from '../stores/auth-store';

interface SyncStatusIndicatorProps {
  /** Compact mode for embedding in headers */
  compact?: boolean;
  /** Custom style overrides */
  style?: object;
}

/**
 * Format a date to a human-readable relative time or time string
 */
function formatSyncTime(date: Date | null): string {
  if (!date) return 'Never';

  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  compact = false,
  style,
}) => {
  const { isSignedIn } = useAuthStore();
  const { syncState, syncToCloud } = useExamStore();

  // Don't show sync status if user is not signed in
  if (!isSignedIn) return null;

  const { pendingCount, isSyncing, lastSyncedAt, lastSyncError } = syncState;

  const handleRetrySync = async () => {
    try {
      await syncToCloud();
    } catch {
      // Error is captured in syncState.lastSyncError
    }
  };

  // Compact mode: single-line indicator
  if (compact) {
    if (isSyncing) {
      return (
        <View style={[styles.compactContainer, style]}>
          <ActivityIndicator size="small" color={colors.info} />
          <Text style={styles.compactText}>Syncing...</Text>
        </View>
      );
    }

    if (pendingCount > 0) {
      return (
        <TouchableOpacity
          onPress={handleRetrySync}
          style={[styles.compactContainer, styles.compactPending, style]}
        >
          <AlertTriangle size={12} color={colors.warning} strokeWidth={2} />
          <Text style={[styles.compactText, { color: colors.warning }]}>
            {pendingCount} pending
          </Text>
        </TouchableOpacity>
      );
    }

    if (lastSyncedAt) {
      return (
        <View style={[styles.compactContainer, style]}>
          <Check size={12} color={colors.success} strokeWidth={2} />
          <Text style={[styles.compactText, { color: colors.success }]}>Synced</Text>
        </View>
      );
    }

    return null;
  }

  // Full mode: card-style indicator
  return (
    <View style={[styles.container, style]}>
      {/* Syncing state */}
      {isSyncing && (
        <View style={[styles.statusRow, styles.syncingRow]}>
          <View style={styles.statusLeft}>
            <ActivityIndicator size="small" color={colors.info} />
            <Text style={styles.statusText}>Syncing to cloud...</Text>
          </View>
          <Cloud size={16} color={colors.info} strokeWidth={2} />
        </View>
      )}

      {/* Pending items */}
      {!isSyncing && pendingCount > 0 && (
        <View style={[styles.statusRow, styles.pendingRow]}>
          <View style={styles.statusLeft}>
            <AlertTriangle size={16} color={colors.warning} strokeWidth={2} />
            <View>
              <Text style={styles.statusText}>
                {pendingCount} exam{pendingCount !== 1 ? 's' : ''} pending sync
              </Text>
              {lastSyncError && <Text style={styles.errorText}>{lastSyncError}</Text>}
            </View>
          </View>
          <TouchableOpacity onPress={handleRetrySync} style={styles.retryButton}>
            <RefreshCw size={14} color={colors.textHeading} strokeWidth={2} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Synced state */}
      {!isSyncing && pendingCount === 0 && lastSyncedAt && (
        <View style={[styles.statusRow, styles.syncedRow]}>
          <View style={styles.statusLeft}>
            <Check size={16} color={colors.success} strokeWidth={2} />
            <Text style={styles.statusText}>Synced {formatSyncTime(lastSyncedAt)}</Text>
          </View>
          <Cloud size={16} color={colors.success} strokeWidth={2} />
        </View>
      )}

      {/* No sync history */}
      {!isSyncing && pendingCount === 0 && !lastSyncedAt && (
        <View style={[styles.statusRow, styles.idleRow]}>
          <View style={styles.statusLeft}>
            <Cloud size={16} color={colors.textMuted} strokeWidth={2} />
            <Text style={[styles.statusText, { color: colors.textMuted }]}>Cloud sync ready</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const colors = {
  background: '#232F3E',
  surface: '#1F2937',
  surfaceHover: '#374151',
  borderDefault: '#374151',
  textHeading: '#F9FAFB',
  textMuted: '#9CA3AF',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
  error: '#EF4444',
  pendingBg: 'rgba(245, 158, 11, 0.1)',
  syncingBg: 'rgba(59, 130, 246, 0.1)',
  syncedBg: 'rgba(16, 185, 129, 0.08)',
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Compact mode
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compactPending: {
    backgroundColor: colors.pendingBg,
  },
  compactText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },

  // Full mode
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusText: {
    fontSize: 13,
    color: colors.textHeading,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 11,
    color: colors.error,
    marginTop: 2,
  },

  syncingRow: {
    backgroundColor: colors.syncingBg,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  pendingRow: {
    backgroundColor: colors.pendingBg,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  syncedRow: {
    backgroundColor: colors.syncedBg,
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  idleRow: {
    backgroundColor: colors.surface,
    borderColor: colors.borderDefault,
  },

  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 12,
    color: colors.textHeading,
    fontWeight: '600',
  },
});

export default SyncStatusIndicator;
