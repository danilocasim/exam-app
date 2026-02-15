/**
 * T156: IntegrityBlockedScreen Component
 *
 * Full-screen blocking UI displayed when device fails Play Integrity verification.
 * Shows clear message and provides link to Google Play Store.
 * No navigation access or app functionality available when this screen is shown.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, ExternalLink } from 'lucide-react-native';

interface IntegrityBlockedScreenProps {
  /** Error message to display (defaults to standard Play Store message) */
  message?: string;
  /** Whether to show retry button (for transient errors) */
  showRetry?: boolean;
  /** Callback when retry button is pressed */
  onRetry?: () => void;
}

/**
 * IntegrityBlockedScreen Component
 *
 * Implements FR-004, FR-005, FR-006:
 * - Full-screen blocking message
 * - "Get from Play Store" button
 * - No partial access to app functionality
 */
export const IntegrityBlockedScreen: React.FC<IntegrityBlockedScreenProps> = ({
  message = 'For security reasons, this app must be downloaded from Google Play.',
  showRetry = false,
  onRetry,
}) => {
  /**
   * Open Google Play Store listing for the app
   * Falls back to showing instructions if Play Store is not available
   */
  const handleOpenPlayStore = async () => {
    // Replace with actual package name when available
    const packageName = 'com.examapp.cloudprep'; // TODO: Replace with actual package name
    const playStoreUrl = `market://details?id=${packageName}`;
    const webPlayStoreUrl = `https://play.google.com/store/apps/details?id=${packageName}`;

    try {
      // Try to open Play Store app first
      const canOpen = await Linking.canOpenURL(playStoreUrl);
      if (canOpen) {
        await Linking.openURL(playStoreUrl);
      } else {
        // Fallback to web Play Store
        await Linking.openURL(webPlayStoreUrl);
      }
    } catch (error) {
      console.error('[IntegrityBlockedScreen] Failed to open Play Store:', error);
      // If both fail, user will need to manually search for the app
      // This is an acceptable fallback per spec edge cases
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Warning Icon */}
        <View style={styles.iconContainer}>
          <AlertTriangle size={80} color="#EF4444" strokeWidth={1.5} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Installation Verification Failed</Text>

        {/* Message */}
        <Text style={styles.message}>{message}</Text>

        {/* Get from Play Store Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleOpenPlayStore}
          activeOpacity={0.8}
        >
          <ExternalLink size={20} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={styles.primaryButtonText}>Open Google Play Store</Text>
        </TouchableOpacity>

        {/* Retry Button (for transient errors only) */}
        {showRetry && onRetry && (
          <TouchableOpacity style={styles.secondaryButton} onPress={onRetry} activeOpacity={0.8}>
            <Text style={styles.secondaryButtonText}>Retry Verification</Text>
          </TouchableOpacity>
        )}

        {/* Footer Instructions */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            To use this app, please download it from the official Google Play Store.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#232F3E', // AWS dark background
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 32,
    padding: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.1)', // Error color with transparency
    borderRadius: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F9FAFB', // Light text
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    fontWeight: '400',
    color: '#D1D5DB', // Secondary text
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    maxWidth: 320,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9900', // AWS orange
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#FF9900',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonIcon: {
    marginRight: 8,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 16,
    width: '100%',
    maxWidth: 320,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  footer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    maxWidth: 320,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});
