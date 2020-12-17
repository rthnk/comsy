import { IRoute } from '../types';
import auth from './auth';
import admin from './admin';

export default [
  {path: '/api/v1/auth/', router: auth} as IRoute,
  {path: '/admin', router: admin} as IRoute,
]
