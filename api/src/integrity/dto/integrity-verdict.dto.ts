/**
 * T159: Integrity Verdict DTOs
 * 
 * Response DTOs for Play Integrity verification.
 * Implements interfaces from data-model.md.
 */

/**
 * Play Integrity verdict from Google's API
 * 
 * This represents the decrypted token payload returned by Google Play Integrity API.
 * The mobile client uses these verdicts to determine if the app should be allowed to run.
 * 
 * Verification passes when:
 * - appRecognitionVerdict === 'PLAY_RECOGNIZED'
 * - appLicensingVerdict === 'LICENSED'
 * - deviceRecognitionVerdict === 'MEETS_DEVICE_INTEGRITY' or 'MEETS_STRONG_INTEGRITY'
 */
export interface PlayIntegrityVerdict {
  /**
   * Whether the app is recognized by Google Play
   * - PLAY_RECOGNIZED: App signature matches the one uploaded to Play Console
   * - UNRECOGNIZED_VERSION: App is signed with a different key (sideloaded/tampered)
   * - UNKNOWN: Unable to determine (treat as failure)
   */
  appRecognitionVerdict: 'PLAY_RECOGNIZED' | 'UNRECOGNIZED_VERSION' | 'UNKNOWN';

  /**
   * Whether the user is licensed to use this app
   * - LICENSED: User installed from Google Play Store (purchased or free download)
   * - UNLICENSED: User does not have a valid license (sideloaded)
   * - UNKNOWN: Unable to determine (treat as failure)
   */
  appLicensingVerdict: 'LICENSED' | 'UNLICENSED' | 'UNKNOWN';

  /**
   * Device integrity check result
   * - MEETS_DEVICE_INTEGRITY: Device passes basic integrity checks
   * - MEETS_STRONG_INTEGRITY: Device passes strong integrity checks (SafetyNet equivalent)
   * - UNKNOWN: Unable to determine device integrity
   * 
   * Note: We accept MEETS_DEVICE_INTEGRITY (don't require STRONG); allows non-rooted but modified devices
   */
  deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY' | 'MEETS_STRONG_INTEGRITY' | 'UNKNOWN';

  /**
   * Additional fields from Google Play Integrity API
   * Not used for verification but may be useful for debugging
   */
  [key: string]: any;
}

/**
 * Response DTO for POST /api/integrity/verify endpoint
 * 
 * Backend returns this structure to mobile client after decrypting the token.
 * Mobile client interprets the verdict and decides whether to block/allow access.
 */
export class IntegrityVerifyResponse {
  /**
   * Whether the verification succeeded
   * - true: Token decrypted successfully, verdict available
   * - false: Token decryption failed, error message provided
   */
  success: boolean;

  /**
   * Decrypted Play Integrity verdict (present when success=true)
   */
  verdict?: PlayIntegrityVerdict;

  /**
   * Error message (present when success=false)
   * Examples: 'Invalid token', 'Google API unavailable', 'Token expired'
   */
  error?: string;
}
