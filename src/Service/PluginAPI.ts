import assert from 'assert';
import { IHook, ICommand } from './types';
import Service from './Service';

interface IOpts {
  id: string;
  key: string;
  service: Service;
}

export default class PluginAPI {

  id: string;
  key: string;
  service: Service;


  constructor(opts: IOpts) {
    this.id = opts.id;
    this.key = opts.key;
    this.service = opts.service;
  }

  // 注册方法
  registerMethod({ name, fn, exitsError = true }: { name: string; fn?: Function; exitsError?: boolean; }){
    // 判断插件是否已经存在
    if (this.service.pluginMethods[name]) {
      if (exitsError) {
        throw new Error(
          `api.registerMethod() failed, method ${name} is already exist.`,
        );
      } else {
        return;
      }
    }

    this.service.pluginMethods[name] = 
    fn || 
    function (fn: Function) {
      const hook = {
        key: name,
        fn,
      }
      // @ts-ignore
      this.register(hook);
    }
  }

  // 注册钩子
  register(hook: IHook) {
    this.service.hooksByPluginId[this.id] = (
      this.service.hooksByPluginId[this.id] || []
    ).concat(hook);
  }

  // 注册指令
  registerCommand(command: ICommand) {
    const { name, alias } = command;
    assert(
      !this.service.commands[name],
      `api.registerCommand() failed, the command ${name} is exists.`,
    );
    this.service.commands[name] = command;
    if (alias) {
      this.service.commands[alias] = name;
    }
  }

  // 设置不开启的插件
  skipPlugins(pluginIds: string[]) {
    pluginIds.forEach((pluginId) => {
      this.service.skipPluginIds.add(pluginId);
    });
  }
}