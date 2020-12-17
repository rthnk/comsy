import { IHandler, IRequest, IResponse } from '../types';
import { debug, envConfig } from '../utils';
import { getMiddleware } from './auth';

function logMiddleware(req: IRequest, _res: IResponse, next: IHandler): void {
  debug('*', req.method, req.originalUrl);
  next();
}

function allowRemotes(req: IRequest, res: IResponse, next: IHandler): void {
  const allowed = envConfig('ALLOW_CSP') || '';
  res.set("Content-Security-Policy", `default-src 'self' ${allowed} 'unsafe-inline' 'unsafe-eval'; img-src 'self' ${allowed} data:;`);
  next();
}

export default [
  getMiddleware(),
  allowRemotes as IHandler,
  logMiddleware as IHandler
]
