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
  private port: Number;
  private middlewares: IHandler[] = [];

  constructor(port: Number) {
    this.port = port;
    this.server = express();
    this.prepareMiddlewares();
  }

  addRouters(routers: IRoute[]) {
    console.log('Routers:')
    routers.map((router: IRoute) => {
      this.logRoute(router)
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

  addMiddlewares(middlewares: IHandler[]) {
    console.log('Loading extra middlewares');
    this.middlewares = middlewares;
    this.middlewares.map((middleware: IHandler) => {
      this.server.use(middleware);
    });
  }

  prepareMiddlewares() {
    console.log('Loading base middlewares');
    this.server.use(express.json());
    this.server.use(express.urlencoded({ extended: true }));
    this.server.use(helmet());
    // this.server.use(rateLimit({
    //   windowMs: 60 * 60 * 1000, // 60 minutes
    //   max: 1000, // limit each IP to 300 requests per windowMs
    //   handler(req, res, next) {
    //     console.log(req.url)
    //   }
    // }));
    this.server.use(cors());
    this.server.use(passport.initialize());
  }

  scaffoldModels(models: String[]) {
    console.log('Scaffolding');
    const routers = models
      .map((model: String) => scaffoldModel(model))
      ;
    routers
      .map((router: any) => ({path: '/api/v1', router}))
      .map((router: IRoute) => this.logRoute(router))
      ;
    this.server.get('/api/v1/resources', (req: IRequest, res: IResponse) => {
      res.status(200).json(JSON_ANSWER({
        resources: getInfo('resources')
      }));
    });
    routers.map((router: any) => this.server.use('/api/v1', router));
  }

  errorHandler(error: Error, req: IRequest, res: IResponse, next: IHandler) {
    if (error) {
      console.error(`Critical Error: ${error}`);
      return res.status(500).send(JSON_ERROR('Critical error, contact the adminitrator'));
    }
    next(error);
  }

  start() {
    this.server.use(this.errorHandler);
    this.server.listen(this.port, () => {
      console.log(`Listening at ${this.port}`)
    });
  }

}

