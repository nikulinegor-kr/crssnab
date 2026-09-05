import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.p03d26285f32f457cbdfeb9b17be007d2',
  appName: 'crssnab',
  webDir: 'dist',
  // Режим «автообновление с сайта»: приложение открывает опубликованную версию,
  // поэтому правки видны сразу, без пересборки в Xcode.
  //
  // Если Apple при ревью потребует автономную сборку — просто удалите блок
  // `server` целиком, выполните `npm run build` и `npx cap sync`.
  server: {
    url: 'https://crssnab.com',
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#ffffff',
      showSpinner: false,
      launchAutoHide: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
