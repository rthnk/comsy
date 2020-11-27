import mongoose, { Model } from 'mongoose';
import { User } from './users';
import { Permissions } from './permissions';
import { IDBConnectionInfo } from '../types';

const globalContext = (global as any);

export function initializeDatabase(dbInfo: IDBConnectionInfo = {} as IDBConnectionInfo) {
  const username: String = dbInfo.username || '';
  const password: String = dbInfo.password || '';
  const host: String = dbInfo.host || 'localhost';
  const port: Number|String = dbInfo.port || 27017;
  const database: String = dbInfo.database || 'comsy';
  const protocol: String = dbInfo.protocol || 'mongodb';
  if (!globalContext._db) {
    let auth = '';
    if (username) {
      auth = `${username}:${password}@`;
    }
    let _port = '';
    if (port && !protocol.includes('+srv')) {
      _port = `:${port}`;
    }
    const connectString = `${protocol}://${auth}${host}${_port}/${database}?retryWrites=true&w=majority`;
    mongoose.connect(connectString, {useNewUrlParser: true, useUnifiedTopology: true});
    globalContext._db = true;
    globalContext.models = {
      User,
      Permissions,
    };
    console.log(`Database initialized (${host}:${port}/${database})`);
  }
}

export function getModel(name: string|String): Model<any> {
  return globalContext.models[name.toString()];
}

export function getModelNames(): String[] {
  return Object.getOwnPropertyNames(globalContext.models);
}
