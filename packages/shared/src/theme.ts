/**
 * Centralized design tokens for the exam app.
 *
 * All screens and components should import colors, spacing, typography, and
 * radii from here instead of declaring local palettes.
 */

// ── Colors ──
export const colors = {
  // Backgrounds
  background: '#1A1F2B',
  surface: '#242A38',
  surfaceHover: '#2E3545',
  surfaceSelected: '#3A3225', // warm amber tint for selected states

  // Borders
  borderDefault: '#2E3545',
  borderSubtle: '#3A4150',
  borderAccent: '#FF9900',

  // Text
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  textDisabled: '#6B7280',

  // Track (progress bars, slider rails)
  trackGray: '#3A4150',

  // Primary
  primaryOrange: '#FF9900',
  secondaryOrange: '#EC7211',
  orangeDark: 'rgba(255, 153, 0, 0.15)',
  orangeLight: '#FFB84D',

  // Gold / Premium
  gold: '#F5A623',
  goldDark: 'rgba(245, 166, 35, 0.15)',

  // Semantic – Success
  success: '#10B981',
  successLight: '#6EE7B7',
  successDark: 'rgba(16, 185, 129, 0.15)',

  // Semantic – Error
  error: '#EF4444',
  errorLight: '#FCA5A5',
  errorDark: 'rgba(239, 68, 68, 0.15)',

  // Semantic – Warning
  warning: '#F59E0B',
  warningDark: 'rgba(245, 158, 11, 0.15)',

  // Semantic – Info
  info: '#3B82F6',
  infoDark: 'rgba(59, 130, 246, 0.15)',
} as const;

// ── Spacing (8pt grid) ──
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

// ── Border Radii ──
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

// ── Typography ──
export const typography = {
  /** Screen / section titles */
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.textHeading,
  },
  /** Card labels, field labels */
  label: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.textHeading,
  },
  /** Body text */
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: colors.textBody,
  },
  /** Small helper text, secondary info */
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.textMuted,
  },
  /** Badge / chip text */
  badge: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  /** Section headers (uppercase) */
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
} as const;

// ── Shared constants ──
export const MIN_TAP_SIZE = 44;
