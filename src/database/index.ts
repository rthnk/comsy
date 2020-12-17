import mongoose, { Model, Schema, model } from 'mongoose';
import { User } from './users';
import { Permissions } from './permissions';
import { Collections } from './collections';
import { plural } from 'pluralize';
import { getInfo, addInfo, debug, deleteInfoValue } from '../utils';
import { IDBConnectionInfo } from '../types';
import {removeScaffoldInstance, scaffoldModel} from '../logic/scaffolder';

const globalContext = (global as any);

export function initializeDatabase(dbInfo: IDBConnectionInfo = {} as IDBConnectionInfo): void {
  const username: string = dbInfo.username || '';
  const password: string = dbInfo.password || '';
  const host: string = (dbInfo.host || 'localhost') as string;
  const port: number|string = dbInfo.port || 27017;
  const database: string = (dbInfo.database || 'comsy') as string;
  const protocol: string = (dbInfo.protocol || 'mongodb') as string;
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
    mongoose.connect(connectString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      useCreateIndex: true
    });
    globalContext._db = true;
    globalContext.models = {
      User,
      Permissions,
      Collections,
    };
    console.log(`Database initialized (${host}:${port}/${database})`);
  }
}

export function generateModelFromSchema(schemaData: any) {
  console.log(` - (Re)Loading ${schemaData.name}`);
  try {
    const modelname = schemaData.name;
    const resource = plural(modelname);
    const schemaStructure = JSON.parse(schemaData.schema_structure)
    const dynamicSchema = new Schema(schemaStructure);
    const dynamicModel = model(modelname, dynamicSchema);
    globalContext.models[modelname] = dynamicModel;
    removeScaffoldInstance(modelname);
    scaffoldModel(modelname);
  } catch(error) {
    console.error(error);
  }
}

export async function loadDynamicModels() {
  console.log('Dynamic models');
  const schemas = await Collections.find();
  schemas.forEach(generateModelFromSchema);
}

export function deleteModel(name: string): void {
  delete globalContext.models[name];
  delete mongoose.models[name];
  deleteInfoValue("resources", name);
}

export async function createModel(name: string): Promise<void> {
  const schemas = await Collections.find({
    name
  });
  const schema = schemas.pop();
  console.log('schema', schema);
  if (schema) {
    generateModelFromSchema(schema);
  }
}

export async function updateModel(name: string): Promise<void> {
  deleteModel(name);
  const schemas = await Collections.find({
    name
  });
  const schema = schemas.pop();
  if (schema) {
    generateModelFromSchema(schema);
  }
}

export function getModel(name: string): Model<any> {
  return globalContext.models[name];
}

export function getModelNames(): string[] {
  return Object.getOwnPropertyNames(globalContext.models);
}
