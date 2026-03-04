/**
 * Expo config plugin to add missingDimensionStrategy for react-native-iap.
 *
 * react-native-iap defines a "store" product flavor dimension (amazon | play).
 * The consuming :app project must declare which variant to use, otherwise Gradle
 * cannot resolve the dependency.  This plugin injects:
 *
 *   missingDimensionStrategy "store", "play"
 *
 * into android.defaultConfig inside app/build.gradle.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

function withPlayStoreIap(config) {
  return withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;

    // Only inject once
    if (buildGradle.includes('missingDimensionStrategy "store"')) {
      return config;
    }

    // Insert missingDimensionStrategy right after the defaultConfig opening brace
    config.modResults.contents = buildGradle.replace(
      /defaultConfig\s*\{/,
      `defaultConfig {
        missingDimensionStrategy "store", "play"`,
    );

    return config;
  });
}

module.exports = withPlayStoreIap;
