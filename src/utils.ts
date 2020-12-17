import { resolve } from 'path';
import AWS from 'aws-sdk';
import { config } from 'dotenv';
import { v4 as uuid } from 'uuid';
import { createHmac } from 'crypto';
import chalk from 'chalk';
import {plural} from 'pluralize';

const _INFO_PACKAGE: any = {};

export function addInfo(key: string, value: string) {
  if (!_INFO_PACKAGE[key]) {
    _INFO_PACKAGE[key] = [];
  }
  if (!_INFO_PACKAGE[key].includes(value)) {
    _INFO_PACKAGE[key].push(value);
  }
}

export function getInfo(key: string, defaultValue: any[] = []) {
  return _INFO_PACKAGE[key] || defaultValue;
}

export function deleteInfoValue(key: string, value: string) {
  const dValue = plural(value.toLowerCase());
  _INFO_PACKAGE[key] = (_INFO_PACKAGE[key] || []).filter((evalue: string) => evalue !== dValue);
  return _INFO_PACKAGE[key];                                                                                         
}                                                                                                                    
                                                                                                                     
export function JSON_ERROR(errors: null | any | any[], data?: any, meta?: any): any {                                
  const err = Array.isArray(errors) ? [...errors] : [errors];                                                        
  const _errors = err.filter(e => !!e).map(e => e.message ? e.message : e);                                          
  const newData = data ? data : {};                                                                                  
  if (!data) {
    newData.status = _errors.join('\n')
  }
  return {
    data: {
      ...data
    },
    errors: _errors,
    meta: {
      ...(meta || {})
    }
  };
}

export function JSON_ANSWER(data: any, meta?: any): any {
  return {
    data: {
      ...data
    },
    errors: [],
    meta: {
      ...(meta || {})
    }
  };
}

export const sha256 = (str: string, secret?: string): string => createHmac('sha256', secret || str)
                   .update(str)
                   .digest('hex');

export async function makeAWSFileLink (props: any, targetFolder?: string) {
  const {name, type} = props;
  if (!name || !type) {
    return props.path;
  }
  if (!(global as any)._aws) {
    AWS.config.update({
      accessKeyId: process.env.AMAZON_S3_KEY, // Generated on step 1
      secretAccessKey: process.env.AMAZON_S3_KEY_SECRET, // Generated on step 1
      region: process.env.AMAZON_S3_REGION, // Must be the same as your bucket
      signatureVersion: 'v4',
    });
  }
  if (!process.env.AMAZON_S3_ENDPOINT) {
    return null;
  }
  const splitname = name.split('.')
  const newName = `${uuid()}.${splitname[splitname.length - 1]}`
  const params = {
    Bucket: process.env.AMAZON_S3_BUCKET,
    Key: `${process.env.AMAZON_S3_DEBUG_BASE_FOLDER
      || targetFolder
      || process.env.AMAZON_S3_BASE_FOLDER}/${newName}`,
    Expires: 30 * 60, // 30 minutes
    ContentType: type || 'image/jpeg',
    ACL:'public-read'
  };
  const options = {
    signatureVersion: 'v4',
    region: process.env.AMAZON_S3_REGION, // same as your bucket
    endpoint: new AWS.Endpoint(process.env.AMAZON_S3_ENDPOINT),
    useAccelerateEndpoint: true,
  }
  const client = new AWS.S3(options as any);
  const signedURL = await (new Promise((resolve, reject) => {
    client.getSignedUrl('putObject', params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
      });
  }));
  return signedURL;
}

export function envConfig(key?: string|undefined, parse?: any|undefined) {
  if (!(global as any).$config) {
    try {
      if (process.env['NODE_ENV']) {
        config({
          path: resolve(process.cwd(), `.env.${process.env['NODE_ENV']}`)
        });
      } else {
        config();
      }
    } catch (error) {
      config();
    }
    (global as any).$config = true;
  }
  const trans = parse ? parse : (val: string) => val;
  if (key) {
    return trans(process.env[key]);
  }
}

export function debug(...values: any[]) {
  const env = `${envConfig('NODE_ENV')}`;
  if (env.endsWith('local')) {
    const _e = new Error();
    let PREFIX = '';
    if (_e.stack) {
      const err = _e.stack.split('\n');
      const parts = err
        .filter(e => e !== 'Error')
        .map(part => part.replace(' at ', ''))
        .map(part => part.split(__dirname).map(val => val.trim()))
        ;
      if (parts && parts.length) {
        const P2 = parts[1][1].split(':');
        PREFIX = `${parts[1][0].replace(' (', '@')}${P2[0]}:${P2[1]}`;
      }
    }
    const final = values.map(value => {
      const newValue = typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : value;
      return `${newValue}`
    }).join(' ');
    console.log(`${chalk.red(PREFIX)} ${final}\n`);
  }
}

export function titleCase(str:string) {
  return str.toLowerCase().split(' ').map(function(word:string) {
    return (word.charAt(0).toUpperCase() + word.slice(1));
  }).join(' ');
}

