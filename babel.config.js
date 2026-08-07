module.exports = function (api) {
  api.cache(true);
  // `babel-preset-expo` ya incluye el plugin de react-native-worklets cuando
  // Reanimated está instalado: añadirlo aquí a mano lo duplicaría.
  return {
    presets: ['babel-preset-expo'],
  };
};
