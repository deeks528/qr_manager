module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@app': './src/app',
          '@database': './src/database',
          '@domain': './src/domain',
          '@features': './src/features',
          '@shared': './src/shared',
        },
      },
    ],
  ],
};
