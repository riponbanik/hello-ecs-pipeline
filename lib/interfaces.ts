
import * as fs from 'fs';
import * as yaml from 'yaml';

export function getConfig() {
  let config_file = fs.readFileSync('./config/config.yaml', 'utf8')
  let envVars = yaml.parse(config_file);
  return envVars;
}