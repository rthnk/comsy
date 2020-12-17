import { Request, Router, Response as EResponse, NextFunction } from 'express';

export class DataBaseError implements Error {
  name = 'DatabaseError';
  message: string;
  stack?: string | undefined;

  constructor(message: string) {
    this.message = message;
  }
}

export interface IDBConnectionInfo {
  username: string,
  password: string,
  host: string,
  port: number,
  database: string,
  protocol: string
}

export interface IRoute {
  path: string;
  router: Router
}

// export interface IRequest extends Request {}
export type IRequest = Request;

// export interface IResponse extends EResponse {}
export type IResponse = EResponse;

// export interface IHandler extends NextFunction {}
export type IHandler = NextFunction;

