/**
 * The part of the app config that depends on which build this is.
 *
 * Everything static lives in `app.json`, which Expo hands to this function as
 * `config`; this changes one thing and only when asked to.
 *
 * ## `GAMELOG_ANDROID_ABIS` — which CPU architectures the Android build carries
 *
 * React Native compiles its native libraries once per architecture, and by
 * default an APK carries all four: `armeabi-v7a`, `arm64-v8a`, `x86` and
 * `x86_64`. A phone runs one of them. Expo packages native libraries
 * uncompressed, so the APK on disk carries the full size of all four — React
 * Native, Hermes, Reanimated, the camera's barcode model — which was most of a
 * 170 MB install.
 *
 * Set it (comma-separated) and the build carries only those. The `preview`
 * profile in `eas.json` — the APK that gets sideloaded — sets the two ARM
 * architectures, `armeabi-v7a,arm64-v8a`: every Android phone, 32-bit ones
 * included, and none of the x86 builds only emulators and a few Chromebooks
 * run. Unset, every architecture is built, which is right for a Play Store
 * bundle: Google Play splits an `.aab` per device, so carrying all four there
 * costs nobody anything.
 *
 * Every architecture listed is in the APK whichever phone installs it, so each
 * one costs its full size on every install: `armeabi-v7a` adds roughly two
 * thirds of what `arm64-v8a` weighs. Drop it if no 32-bit phone needs the APK.
 *
 * An ARM-only APK will not install on an x86_64 emulator image that lacks ARM
 * translation. Build one without the variable for that.
 */
module.exports = ({ config }) => {
  const abis = (process.env.GAMELOG_ANDROID_ABIS ?? '')
    .split(',')
    .map((abi) => abi.trim())
    .filter(Boolean);
  if (abis.length === 0) return config;

  return {
    ...config,
    plugins: config.plugins.map((plugin) => {
      const [name, options = {}] = Array.isArray(plugin) ? plugin : [plugin];
      if (name !== 'expo-build-properties') return plugin;
      return [name, { ...options, android: { ...options.android, buildArchs: abis } }];
    }),
  };
};
