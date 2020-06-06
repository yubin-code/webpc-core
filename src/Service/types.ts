import yargs from 'yargs';
import { EnableBy } from './Enums';

export type NodeEnv = 'development' | 'production';

export interface IPluginConfig {
  default?: any;
  schema?: {
    // (joi: joi.Root): joi.Schema;
  };
  onChange?: string | Function;
}

export interface IPlugin {
  id: string;
  // Currently only used for config
  key: string;
  path: string;
  apply: Function;

  config?: IPluginConfig;
  isPreset?: boolean;
  enableBy?: EnableBy | Function;
}

export interface IDep {
  [name: string]: string;
}

export interface IPackage {
  name?: string;
  dependencies?: IDep;
  devDependencies?: IDep;
  [key: string]: any;
}


export interface IHook {
  key: string;
  fn: Function;
  pluginId?: string;
  before?: string;
  stage?: number;
}


export interface ICommand {
  name: string;
  alias?: string;
  description?: string;
  details?: string;
  fn: {
    ({ args }: { args: yargs.Arguments }): void;
  };
}


export interface IPreset extends IPlugin {}