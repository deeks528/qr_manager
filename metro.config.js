const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  transformer: {
    // Force resolution from the project root to avoid nested node_modules issues
    asyncRequireModulePath: require.resolve('metro-runtime/src/modules/asyncRequire'),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
