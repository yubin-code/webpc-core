import { join } from 'path';
import { existsSync } from 'fs';
import Service from '../Service/Service';
import { compatESModuleRequire } from '../utils/index'

interface IOpts {
  cwd: string;
  service: Service;
}

export default class Config {
  cwd: string;
  service: Service;
  
  constructor(opts: IOpts) {
    this.cwd = opts.cwd || process.cwd();
    this.service = opts.service;
  }

  // 读取配置文件
  requireConfigs(configFile: string) {
    // 判断配置文件是否存在
    if(!existsSync(join(this.cwd, configFile))){
      return {}
    }
    // 这句话解决引入文件的时候缓存问题
    delete require.cache[require.resolve(configFile)];
    // 然后引入文件
    return compatESModuleRequire(require(configFile))
  }
  
  // 获取用户的配置文件
  getUserConfig(configName: string) {
    if (configName) {
      // 引入配置文件
      return this.requireConfigs(join(this.cwd, configName));
    } else {
      return {};
    }
  }
}