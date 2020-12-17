import express from 'express';
import passport from 'passport';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { join } from 'path';
import { IHandler, IRequest, IResponse, IRoute } from '../types';
import { getInfo, JSON_ANSWER, JSON_ERROR } from '../utils';
import { scaffoldModel } from '../logic/scaffolder';

export class Server {
  private server: express.Application;
  private port: number;
  private middlewares: IHandler[] = [];
  private routers: Map<string, IHandler>;

  constructor(port: number) {
    this.port = port;
    this.routers = new Map();
    this.server = express();
    this.prepareMiddlewares();
  }

  addRouters(routers: IRoute[]): void {
    console.log('Routers:')
    routers.map((router: IRoute) => {
      try {
        this.logRoute(router)
      } catch(error) {
        console.log(error);
      }
      this.server.use(router.path, router.router);
    });
  }

  logRoute(router: IRoute): IRoute {
    console.log(' -', router.path)
    router.router.stack.forEach((layer: any) => {
      if (layer.route) {
        Object.keys(layer.route.methods).forEach((method: string) => {
          if (layer.route.methods[method]) {
            console.log('    ', method.padEnd(7), ' ', join(router.path, layer.route.path));
          }
        });
      }
    });
    return router;
  }

  addMiddlewares(middlewares: IHandler[]): void {
    console.log('Loading extra middlewares');
    this.middlewares = middlewares;
    this.middlewares.map((middleware: IHandler) => {
      this.server.use(middleware);
    });
  }

  prepareMiddlewares(): void {
    console.log('Loading base middlewares');
    this.server.use(express.json());
    this.server.use(express.urlencoded({ extended: true }));
    this.server.use(helmet());
    //**
    this.server.use(rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 1000, // limit each IP to 300 requests per windowMs
      handler(req: IRequest, res: IResponse, next: IHandler): void {
        console.log(req.url);
        next();
      }
    }));
    // */
    this.server.use(cors());
    this.server.use(passport.initialize());
  }

  scaffoldModels(models: string[]): void {
    console.log('Mounting scaffolded models on server');
    const routers = models.map((modelName: string) => scaffoldModel(modelName));
    routers.forEach((router: any) => this.server.use('/api/v1', router));
    this.server.get('/api/v1/resources', (req: IRequest, res: IResponse) => {
      const resources = getInfo('resources');
      res.status(200).json(JSON_ANSWER({
        values: resources 
      }));
    });
  }

  scaffoldModelsOld(models: string[]): void {
    console.log('Scaffolding');
    const routers = models.map((model: string) => {
      const baseRouter = scaffoldModel(model);
      const handler: any = (req: IRequest, res: IResponse, next: IHandler) => {
        baseRouter(req, res, next);
      };
      this.routers.set(model, handler);
    });
    routers
      .forEach((router: any) => ({path: '/api/v1', router}))
      // .map((router: IRoute) => this.logRoute(router))
      ;
    this.server.get('/api/v1/resources', (req: IRequest, res: IResponse) => {
      const resources = getInfo('resources')
        // .map((res: string) => res.toLowerCase())
        // .filter((val:any, idx:number, slf:any[]) => slf.indexOf(val) === idx)
        ;
      // 
      res.status(200).json(JSON_ANSWER({
        resources 
      }));
    });
    this.routers.forEach((router, route) => {
      console.log(route, router);
      this.server.use('/api/v1', router)
    });
    // routers.map((router: any) => this.server.use('/api/v1', router));
  }

  errorHandler(error: Error, req: IRequest, res: IResponse, next: IHandler): void {
    if (error) {
      console.error(`Critical Error: ${error}`);
      res.status(500).send(JSON_ERROR('Critical error, contact the adminitrator'));
    } else {
      next(error);
    }
  }

  start(): void {
    this.server.use(this.errorHandler);
    this.server.listen(this.port, () => {
      console.log(`Listening at ${this.port}`)
    });
  }

}

