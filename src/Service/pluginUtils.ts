import resolve from 'resolve'
import { dirname, join } from 'path';
import pkgUp from 'pkg-up';
import { PluginType } from './Enums';
import { IPackage } from './types';
import { compatESModuleRequire } from '../utils/index'

interface IOpts {
  pkg: IPackage;
  cwd: string;
}


interface IResolvePresetsOpts extends IOpts {
  presets: string[];
  userConfigPresets: string[];
}


interface IResolvePluginsOpts extends IOpts {
  plugins: string[];
  userConfigPlugins: string[];
}

/**
 * 读取所有的预设和插件
 * @param type 类型
 * @param opts 对象
 */
function getPluginsOrPresets(type: PluginType, opts: IOpts): string[] {
  return [
    ...((opts[type === PluginType.preset ? 'presets' : 'plugins'] as any) || []),
    // 获取用户插件
    ...((opts[
      type === PluginType.preset ? 'userConfigPresets' : 'userConfigPlugins'
    ] as any) || [])
  ].map((path) => {
    return resolve.sync(path, {
      basedir: opts.cwd,
      extensions: ['.js', '.ts'],
    });
  });
}

/**
 * 路径转对象
 * @param param 
 */
export function pathToObj({
  type,
  path,
  cwd,
}: {
  type: PluginType;
  path: string;
  cwd: string;
}){
  
  let pkg = null;
  let isPkgPlugin = false;
  // 获取最近的pachage.json文件
  const pkgJSONPath = pkgUp.sync({ cwd: path });
  // 获取拿到了pachage.json就引入
  if (pkgJSONPath) {
    pkg = require(pkgJSONPath);
    isPkgPlugin = join(dirname(pkgJSONPath), pkg.main || 'index.js') === path
  }
  const id = pkg.name
  const key = pkg.name
  
  return {
    id,
    key,
    path,
    apply() {
      try {
        const ret = require(path);
        return compatESModuleRequire(ret);
      } catch (e) {
        throw new Error(`Register ${type} ${path} failed, since ${e.message}`);
      }
    },
    defaultConfig: null,
  }
}

// 预设
export function resolvePresets(opts: IResolvePresetsOpts) {
  const type = PluginType.preset;
  const presets = [...getPluginsOrPresets(type, opts)];

  return presets.map((path: string) => {
    return pathToObj({
      type,
      path,
      cwd: opts.cwd,
    });
  });
}

// 解析插件
export function resolvePlugins(opts: IResolvePluginsOpts) {
  const type = PluginType.plugin;
  const plugins = getPluginsOrPresets(type, opts);
  
  return plugins.map((path: string) => {
    return pathToObj({
      type,
      path,
      cwd: opts.cwd,
    });
  });
}