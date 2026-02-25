// T107: SettingsScreen with sync status
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Wifi,
  WifiOff,
  Database,
  Clock,
  Info,
  User,
  Cloud,
  Calendar,
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuthStore } from '../stores/auth-store';
import { useStreakStore } from '../stores/streak.store';
import { DatePickerModal } from '../components/DatePickerModal';
import {
  performFullSync,
  getLastSyncVersion,
  getCachedExamTypeConfig,
  isSyncNeeded,
  checkConnectivity,
} from '../services';
import { getDatabase, SYNC_META_KEYS } from '../storage';
import { getTotalQuestionCount } from '../storage/repositories/question.repository';
import { EXAM_TYPE_ID, EXAM_CONFIG } from '../config';

// AWS Modern Color Palette (matching HomeScreen)
const colors = {
  background: '#232F3E',
  surface: '#1F2937',
  surfaceHover: '#374151',
  borderDefault: '#374151',
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  primaryOrange: '#FF9900',
  success: '#10B981',
  error: '#EF4444',
  info: '#3B82F6',
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isSignedIn, user } = useAuthStore();
  const { streak, saveExamDate, loadStreak } = useStreakStore();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncVersion, setSyncVersion] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [examTypeName, setExamTypeName] = useState('');
  const [needsSync, setNeedsSync] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const [online, version, count, config, syncNeeded] = await Promise.all([
        checkConnectivity(),
        getLastSyncVersion(),
        getTotalQuestionCount(),
        getCachedExamTypeConfig(),
        isSyncNeeded(),
      ]);

      setIsOnline(online);
      setSyncVersion(version);
      setQuestionCount(count);
      setNeedsSync(syncNeeded);
      if (config) {
        setExamTypeName(config.displayName || config.name);
      }

      // Get last sync timestamp
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM SyncMeta WHERE key = ?',
        [SYNC_META_KEYS.LAST_SYNC_AT],
      );
      setLastSyncAt(row?.value || null);
    } catch (e) {
      console.error('[SettingsScreen] Failed to load status:', e);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadStreak();
  }, [loadStatus]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await performFullSync();
      if (result.success) {
        Alert.alert(
          'Sync Complete',
          `Added: ${result.questionsAdded}\nUpdated: ${result.questionsUpdated}\nVersion: ${result.latestVersion}`,
        );
      } else {
        Alert.alert('Sync Failed', result.error || 'Unknown error');
      }
      await loadStatus();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatExamDate = (iso: string): string => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleSetExamDate = () => {
    setShowDatePicker(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.textHeading} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentInner,
          { paddingBottom: Math.max(40, insets.bottom) },
        ]}
      >
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Auth')}
          >
            <View style={styles.accountRow}>
              {isSignedIn && user ? (
                <>
                  <View style={styles.accountAvatarWrap}>
                    {user.picture ? (
                      <Image source={{ uri: user.picture }} style={styles.accountAvatarImg} />
                    ) : (
                      <View style={styles.accountAvatar}>
                        <Text style={styles.accountAvatarText}>
                          {user.name?.charAt(0).toUpperCase() ||
                            user.email?.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.connectedDot} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>{user.name || 'Signed In'}</Text>
                    <Text style={styles.accountEmail}>{user.email}</Text>
                  </View>
                  <View style={styles.connectedBadge}>
                    <Text style={styles.connectedText}>Connected</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.accountAvatar, { backgroundColor: colors.surfaceHover }]}>
                    <User size={18} color={colors.textMuted} strokeWidth={2} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>Sign in with Google</Text>
                    <Text style={styles.accountEmail}>Sync progress across devices</Text>
                  </View>
                </>
              )}
              <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Connectivity Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Network</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              {isOnline ? (
                <Wifi size={20} color={colors.success} />
              ) : (
                <WifiOff size={20} color={colors.error} />
              )}
              <Text style={styles.rowLabel}>Status</Text>
              <Text
                style={[
                  styles.rowValue,
                  {
                    color:
                      isOnline === null
                        ? colors.textMuted
                        : isOnline
                          ? colors.success
                          : colors.error,
                  },
                ]}
              >
                {isOnline === null ? 'Checking...' : isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        {/* Sync Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Database size={20} color={colors.primaryOrange} />
              <Text style={styles.rowLabel}>Questions</Text>
              <Text style={styles.rowValue}>{questionCount}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Info size={20} color={colors.info} />
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>{syncVersion}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Clock size={20} color={colors.textMuted} />
              <Text style={styles.rowLabel}>Last Sync</Text>
              <Text style={styles.rowValue}>{lastSyncAt ? formatDate(lastSyncAt) : 'Never'}</Text>
            </View>
            {needsSync && (
              <>
                <View style={styles.divider} />
                <View
                  style={[
                    styles.row,
                    {
                      backgroundColor: 'rgba(255, 153, 0, 0.1)',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      marginTop: 4,
                    },
                  ]}
                >
                  <RefreshCw size={16} color={colors.primaryOrange} />
                  <Text style={[styles.rowLabel, { color: colors.primaryOrange, fontSize: 13 }]}>
                    Sync recommended — new content may be available
                  </Text>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
            onPress={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <RefreshCw size={18} color="#fff" />
            )}
            <Text style={styles.syncButtonText}>{isSyncing ? 'Syncing...' : 'Sync Now'}</Text>
          </TouchableOpacity>
        </View>

        {/* Study Plan Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Study Plan</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={handleSetExamDate}>
              <Calendar size={20} color={colors.primaryOrange} />
              <Text style={styles.rowLabel}>Target Exam Date</Text>
              <Text style={styles.rowValue}>
                {streak?.examDate ? formatExamDate(streak.examDate) : 'Not set'}
              </Text>
              <ChevronRight size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {streak?.examDate && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Clock size={20} color={colors.info} />
                  <Text style={styles.rowLabel}>Days remaining</Text>
                  <Text
                    style={[
                      styles.rowValue,
                      {
                        color: (() => {
                          const days = Math.ceil(
                            (new Date(streak.examDate + 'T00:00:00').getTime() - Date.now()) /
                              86400000,
                          );
                          return days <= 7
                            ? colors.error
                            : days <= 30
                              ? colors.primaryOrange
                              : colors.success;
                        })(),
                      },
                    ]}
                  >
                    {Math.max(
                      0,
                      Math.ceil(
                        (new Date(streak.examDate + 'T00:00:00').getTime() - Date.now()) / 86400000,
                      ),
                    )}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Exam Type</Text>
              <Text style={styles.rowValue}>{examTypeName || EXAM_TYPE_ID}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Passing Score</Text>
              <Text style={styles.rowValue}>{EXAM_CONFIG.PASSING_SCORE}%</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Questions per Exam</Text>
              <Text style={styles.rowValue}>{EXAM_CONFIG.QUESTIONS_PER_EXAM}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Time Limit</Text>
              <Text style={styles.rowValue}>{EXAM_CONFIG.TIME_LIMIT_MINUTES} min</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        currentDate={streak?.examDate ?? null}
        onSave={async (date) => {
          await saveExamDate(date);
          setShowDatePicker(false);
        }}
        onClear={async () => {
          await saveExamDate(null);
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textHeading,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.textBody,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textHeading,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderDefault,
    marginHorizontal: 12,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryOrange,
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 12,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 12,
  },
  accountAvatarWrap: {
    position: 'relative',
  },
  accountAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  accountAvatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textHeading,
  },
  accountEmail: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  connectedDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  connectedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 4,
  },
  connectedText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
});
