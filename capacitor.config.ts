import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.megateknik.pos',
  appName: 'Mega Teknik POS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
