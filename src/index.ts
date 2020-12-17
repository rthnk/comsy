import { envConfig } from './utils';
import { Server } from './common/server';
import { MailSender } from './common/mailsender';
import middlewares from './middlewares';
import routers from './routers';
import { initializeDatabase, getModelNames, loadDynamicModels } from './database';
import { updateModel } from './database';
import { IDBConnectionInfo } from './types';

async function main(env: any) {
  console.log('\n\nStarting system');
  initializeDatabase({
    username: envConfig('DATABASE_USERNAME'),
    password: envConfig('DATABASE_PASSWORD'),
    host: envConfig('DATABASE_HOST'),
    port: envConfig('DATABASE_PORT'),
    protocol: envConfig('DATABASE_PROTOCOL'),
    database: envConfig('DATABASE_DATABASE')
  } as IDBConnectionInfo);
  const server = new Server(envConfig('PORT'));
  server.addMiddlewares(middlewares);
  server.addRouters(routers);
  await loadDynamicModels();
  server.scaffoldModels(getModelNames());
  server.start()
}

main(envConfig());
