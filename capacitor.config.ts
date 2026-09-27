import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.biyyu.app',
  appName: 'Biyyu',
  webDir: 'public',
  server: {
    url: 'https://vantavaru-test.vercel.app',
    cleartext: false
  }
};

export default config;
