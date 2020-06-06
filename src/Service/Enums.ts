export enum PluginType {
  preset = 'preset',
  plugin = 'plugin',
}

export enum EnableBy {
  register = 'register',
  config = 'config',
}

export enum ApplyPluginsType {
  add = 'add',
  modify = 'modify',
  event = 'event',
}


export enum ServiceStage {
  uninitialized,
  constructor,
  init,
  initPresets,
  initPlugins,
  initHooks,
  pluginReady,
  getConfig,
  getPaths,
  run,
}
