# Universal QR Profile Manager

Offline-first React Native application for managing reusable QR profiles.

The MVP scope is locked in `docs/02_MVP_LOCK.md`.


- .
```powershell
cd "C:\Desktop\QR manager"
$env:Path += ";C:\Users\deeks\AppData\Local\Android\Sdk\platform-tools"
adb reverse tcp:8081 tcp:8081
npx react-native start --reset-cache
```

```powershell
cd "C:\Desktop\QR manager"
$env:Path += ";C:\Users\deeks\AppData\Local\Android\Sdk\platform-tools"
npm run android
```

- To get .apk
```powershell
cd android
./gradlew assembleRelease
```

- If you only need a debug APK
```powershell
cd android
.\gradlew assembleDebug
```

- The generated will be at `./android/app/build/outputs/apk/release/app-release.apk`

### set app icon

- ```npm install --save-dev react-native-make```
- ```npx react-native-make set-icon --path ./assets/icon.png```
- in react-native.config.js >> ```  assets: ['./node_modules/react-native-vector-icons/Fonts']```