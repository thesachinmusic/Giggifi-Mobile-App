// Static config lives in app.json. This only exists so a REHEARSAL test build can
// talk to a backend over plain http on the local network (Android blocks that by
// default). Every normal build leaves ALLOW_CLEARTEXT unset and is unchanged.
module.exports = ({ config }) => {
  if (process.env.ALLOW_CLEARTEXT !== "1") return config;
  return {
    ...config,
    plugins: (config.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) && plugin[0] === "expo-build-properties"
        ? [plugin[0], { ...plugin[1], android: { ...plugin[1].android, usesCleartextTraffic: true } }]
        : plugin,
    ),
  };
};
