const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch the entire workspace so Metro can resolve @exam-app/shared
config.watchFolders = [workspaceRoot];

// Prevent Metro from walking up the directory tree — only use the paths below.
// This avoids duplicate react-native copies when packages/shared/src/ files
// would otherwise resolve from root node_modules.
config.resolver.disableHierarchicalLookup = true;

// Monorepo: resolve modules from both the app and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './src/global.css' });
