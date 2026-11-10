import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.metrodash.game',
  appName: 'Metro Dash 3D',
  webDir: 'dist',
  backgroundColor: '#0b1026',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0b1026',
  },
};

export default config;
