import { join } from 'path'
import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { AsyncSeriesWaterfallHook } from 'tapable';
import assert from 'assert';
import { IPlugin, IPreset, IHook, IPackage, ICommand, NodeEnv } from './types';
import { PluginType, ApplyPluginsType, EnableBy, ServiceStage } from './Enums';
import PluginAPI from './PluginAPI';
import Config from '../Config/Config'; 
import { pathToObj, resolvePresets, resolvePlugins } from './pluginUtils';
import loadDotEnv from '../utils/loadDotEnv'

export interface IServiceOpts {
  cwd: string;              // 运行指令的目录
  pkg?: IPackage;           // package.json 文件信息
  env?: NodeEnv;            // 环境变量
  configName?: string;      // 配置文件名字
  presets?: string[];       // 预设
  plugins?: string[];       // 插件
}


interface IConfig {
  presets?: string[];
  plugins?: string[];
  [key: string]: any;
}

export default class Service extends EventEmitter {
  cwd: string;
  pkg: IPackage;
  env: string | undefined;
  configName?: string;          // 配置文件名字
  // 附加数据提供子类使用
  additive:{
    [key: string]: any
  };
  // 记录生命周期
  stage: ServiceStage = ServiceStage.uninitialized;

  // 存放初始化插件与预设
  initialPresets: IPreset[];
  initialPlugins: IPlugin[];

  // 保存插件用于实例化
  _extraPlugins: IPlugin[] = [];

  // 插件方法
  pluginMethods: {
    [name: string]: Function;
  } = {};

  // 钩子或者插件id
  hooksByPluginId: {
    [id: string]: IHook[];
  } = {};
  
  // 钩子
  hooks: {
    [key: string]: IHook[];
  } = {};

  // 包括预设和插件
  plugins: {
    [id: string]: IPlugin;
  } = {};

  // 保存指令
  commands: {
    [name: string]: ICommand | string;
  } = {};

  // 声明哪些插件需要被禁用，参数为插件 id 的数组
  skipPluginIds: Set<string> = new Set<string>();
  ApplyPluginsType = ApplyPluginsType;
  // 用户配置
  userConfig: IConfig;
  configInstance: Config;
  EnableBy = EnableBy;
  
  constructor(opts: IServiceOpts){
    super();
    // 获取命令执行路径
    this.cwd = opts.cwd || process.cwd();
    // 获取用户的package.json文件
    this.pkg = opts.pkg || this.resolvePackage();
    // 获取环境变量
    // 如果没有设置环境变量一律按开发环境算
    this.env = opts.env || process.env.NODE_ENV || 'development';
    
    this.configName = opts.configName
    // 附加数据提供子类使用
    this.additive = {}
    // 如果当前目录不存在抛出错误
    assert(existsSync(this.cwd), `cwd ${this.cwd} does not exist.`);

    // 加载环境变量
    this.loadEnv();
    // 获取默认配置
    this.configInstance = new Config({
      cwd: this.cwd,
      service: this
    });
    
    // 获取用户配置文件
    this.userConfig = opts.configName && this.configInstance.getUserConfig(opts.configName)||{}
    
    const baseOpts = {
      pkg: this.pkg,
      cwd: this.cwd,
    };
    /**
     * 预设路径转为对象
     */
    this.initialPresets = resolvePresets({
      ...baseOpts,
      presets: opts.presets || [],
      userConfigPresets: this.userConfig.presets || [],
    });

    /**
     * 插件路径转为对象
     */
    this.initialPlugins = resolvePlugins({
      ...baseOpts,
      plugins: opts.plugins || [],
      userConfigPlugins: this.userConfig.plugins || [],
    });

  }


  /**
   * 记录生命周期
   * @param stage 生命周期
   */
  setStage(stage: ServiceStage) {
    this.stage = stage;
  }

  /**
   * 加载环境变量
   */
  loadEnv(){
    const basePath = join(this.cwd, '.env');
    loadDotEnv(basePath);
  }
  /**
   * 读取用户的package.json文件
   */
  resolvePackage() {
    try {
      return require(join(this.cwd, 'package.json'));
    } catch (e) {
      return {};
    }
  }


  // 判断插件是否存在
  hasPlugins(pluginIds: string[]) {
    return pluginIds.every((pluginId) => {
      const plugin = this.plugins[pluginId];
      return plugin && !plugin.isPreset && this.isPluginEnable(pluginId);
    });
  }

  /**
   * 判断是否启用插件
   * @param pluginId 插件id
   */
  isPluginEnable(pluginId: string) {

    // 判断需要跳过的插件
    if (this.skipPluginIds.has(pluginId)) return false;

    const { key, enableBy } = this.plugins[pluginId];

    // 如果用户设置的了关闭这个插件那么就跳过
    if (this.userConfig[key] === false) return false;
    
    // 配置开启
    if (enableBy === this.EnableBy.config && !(key in this.userConfig)) {
      return false;
    }

    // 函数自定义开启或关闭
    if (typeof enableBy === 'function') {
      return enableBy();
    }

    // 注册开启
    return true;
  }

  /**
   * 应用插件的钩子
   * @param opts 
   */
  async applyPlugins(opts: {
    key: string;
    type: ApplyPluginsType;
    initialValue?: any;
    args?: any;
  }) {
    
    const hooks = this.hooks[opts.key] || [];
    switch (opts.type) {
      case ApplyPluginsType.add:
        if ('initialValue' in opts) {
          assert(
            Array.isArray(opts.initialValue),
            `applyPlugins failed, opts.initialValue must be Array if opts.type is add.`,
          );
        }
        const tAdd = new AsyncSeriesWaterfallHook(['memo']);
        for (const hook of hooks) {
          if (!this.isPluginEnable(hook.pluginId!)) {
            continue;
          }
          tAdd.tapPromise(
            {
              name: hook.pluginId!,
              stage: hook.stage || 0,
              // @ts-ignore
              before: hook.before,
            },
            async (memo: any[]) => {
              const items = await hook.fn(opts.args);
              return memo.concat(items);
            },
          );
        }
        return await tAdd.promise(opts.initialValue || []);
      case ApplyPluginsType.modify:
        const tModify = new AsyncSeriesWaterfallHook(['memo']);
        for (const hook of hooks) {
          if (!this.isPluginEnable(hook.pluginId!)) {
            continue;
          }
          tModify.tapPromise(
            {
              name: hook.pluginId!,
              stage: hook.stage || 0,
              // @ts-ignore
              before: hook.before,
            },
            async (memo: any) => {
              return await hook.fn(memo, opts.args);
            },
          );
        }
        return await tModify.promise(opts.initialValue);
      case ApplyPluginsType.event:
        const tEvent = new AsyncSeriesWaterfallHook(['_']);
        for (const hook of hooks) {
          if (!this.isPluginEnable(hook.pluginId!)) {
            continue;
          }
          tEvent.tapPromise(
            {
              name: hook.pluginId!,
              stage: hook.stage || 0,
              // @ts-ignore
              before: hook.before,
            },
            async () => {
              await hook.fn(opts.args);
            },
          );
        }
        return await tEvent.promise();
      default:
        throw new Error(
          `applyPlugin failed, type is not defined or is not matched, got ${opts.type}.`,
        );
    }
  }
  
  // 执行初始化
  async init(){
    this.setStage(ServiceStage.init);

    // 初始化预设与插件
    this.initPresetsAndPlugins()
    
    /**
     * 把通过 register 注册的插件给钩子
     */
    Object.keys(this.hooksByPluginId).forEach((id) => {
      const hooks = this.hooksByPluginId[id];
      hooks.forEach((hook) => {
        const { key } = hook;
        hook.pluginId = id;
        this.hooks[key] = (this.hooks[key] || []).concat(hook);
      });
    });

    // 组件加载完毕后执行
    this.applyPlugins({
      key: 'onPluginReady',
      type: ApplyPluginsType.event,
    });
  }

  /**
   * 初始化预设与插件
   */  
  initPresetsAndPlugins(){
    this.setStage(ServiceStage.initPresets);
    this._extraPlugins = [];
    while (this.initialPresets.length) {
      this.initPreset(this.initialPresets.shift()!);
    }

    this.setStage(ServiceStage.initPlugins);
    this._extraPlugins.push(...this.initialPlugins);
    while (this._extraPlugins.length) {
      this.initPlugin(this._extraPlugins.shift()!);
    }

  }

  /**
   * 获取插件的api
   * @param opts 获取api
   */
  getPluginAPI(opts: any){
    const pluginAPI = new PluginAPI(opts);
    [
      'onStart',
      'onPluginReady',
    ].forEach((name) => {
      pluginAPI.registerMethod({ name, exitsError: false });
    });

    /**
     * proxy 的方式动态获取最新，以实现边注册边使用的效果
     */
    return new Proxy(pluginAPI, {
      get: (target, prop: string) => {
        if (this.pluginMethods[prop]){
          return this.pluginMethods[prop];
        }
        
        // 提供子类保存数据通讯
        if(this.additive[prop]){
          return this.additive[prop]
        }
        
        // 允许用户读取service上指定的方法
        if(
          [
            'applyPlugins',
            'cwd',
            'pkg',
            'env',
            'userConfig',
            'config',
            'stage',
            'configName',
            'hasPlugins',
            'ApplyPluginsType'
          ]
          .includes(prop)
        ){
          return typeof this[prop] === 'function'
            ? this[prop].bind(this)
            : this[prop];
        }

        return target[prop];
      },
    })
  }

  // 注册插件
  registerPlugin(plugin: IPlugin){
    this.plugins[plugin.id] = plugin;
  }

  /**
   * 初始化预设
   * @param preset 
   */
  initPreset(preset: IPreset){
    const { id, key, apply } = preset;

    const api = this.getPluginAPI({ id, key, service: this });
    // 注册预设
    this.registerPlugin(preset);
    const { presets, plugins } = apply()(api) || {};

    // 注册额外的预设和插件
    if (presets) {
      // 预设先不写
    }

    // 预设插件转为对象
    if (plugins) {
      assert(
        Array.isArray(plugins),
        `plugins returned from preset ${id} must be Array.`,
      );
      this._extraPlugins.push(
        ...plugins.map((path: string) => {
          return pathToObj({
            type: PluginType.plugin,
            path,
            cwd: this.cwd,
          });
        }),
      );
    }
  }

  /**
   * 初始化插件
   * @param plugin 
   */
  initPlugin(plugin: IPlugin){
    const { id, key, apply } = plugin;

    const api = this.getPluginAPI({ id, key, service: this });

    // 注册插件
    this.registerPlugin(plugin);
    apply()(api);
  }

  /**
   * 运行指令
   * @param param
   */
  async run ({ name, args = {} }: { name: string; args?: any }){
    await this.init();
    
    await this.applyPlugins({
      key: 'onStart',
      type: ApplyPluginsType.event,
      args: {
        args,
      },
    });


    this.setStage(ServiceStage.run);
    return this.runCommand({ name, args });
  }


  // 执行指令
  async runCommand({ name, args = {} }: { name: string; args?: any }) {
    args._ = args._ || [];
    // shift the command itself
    if (args._[0] === name) args._.shift();
    const command =
      typeof this.commands[name] === 'string'
        ? this.commands[this.commands[name] as string]
        : this.commands[name];
    assert(command, `运行命令失败 ${name} 命令不存在`);
    const { fn } = command as ICommand;
    return fn({ args });
  }
}
