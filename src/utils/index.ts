const compatESModuleRequire = (m: any)=> {
  return m.default || m;
}

export {
  compatESModuleRequire
}