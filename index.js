/**
 * React Native App Entry Point
 * Universal QR Profile Manager
 */

import { AppRegistry } from 'react-native';
import { App } from './src/app/App';
import { name as appName } from './package.json';

AppRegistry.registerComponent(appName, () => App);
