import PluginAPI from '../lib/Service/PluginAPI';
import Service from '../lib/index';
import { IServiceOpts } from '../lib/Service/Service';
import { ServiceStage } from '../lib/Service/Enums';

interface IEvent<T> {
  (fn: { (args: T): void }): void;
  (args: { fn: { (args: T): void }; before?: string; stage?: number }): void;
}

export interface IApi extends PluginAPI {
  // properties
  cwd: typeof Service.prototype.cwd;
  env: typeof Service.prototype.env;
  pkg: typeof Service.prototype.pkg;
  additive: typeof Service.prototype.additive;
  
  configName: typeof Service.prototype.configName;
  userConfig: typeof Service.prototype.userConfig;
  stage: typeof Service.prototype.stage;
  configInstance: typeof Service.prototype.configInstance;
  ApplyPluginsType: typeof Service.prototype.ApplyPluginsType;
  
  // methods
  applyPlugins: typeof Service.prototype.applyPlugins;
  hasPlugins: typeof Service.prototype.hasPlugins;
  onPluginReady: IEvent<null>;
  onStart: IEvent<{ args: object }>;
}

export { ServiceStage, IServiceOpts }
