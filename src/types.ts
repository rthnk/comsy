import { Request, Router, Response as EResponse, NextFunction } from 'express';

export class DataBaseError implements Error {
  name: string = 'DatabaseError';
  message: string;
  stack?: string | undefined;

  constructor(message: string) {
    this.message = message;
  }
}

export interface IDBConnectionInfo {
  username: string,
  password: string,
  host: String,
  port: Number,
  database: String,
  protocol: String
}

export interface IRoute {
  path: string;
  router: Router
}

export interface IRequest extends Request {}

export interface IResponse extends EResponse {}

export interface IHandler extends NextFunction {}
