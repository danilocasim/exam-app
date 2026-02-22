const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            // Resolve @exam-app/shared to the workspace package source
            '@exam-app/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
          },
        },
      ],
    ],
  };
};
