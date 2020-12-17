import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { JSON_ERROR, sha256, envConfig, debug } from '../utils';
import { IHandler, IRequest, IResponse } from '../types';
import { getModel } from '../database';
import { Model } from 'mongoose';
import { json } from 'express';

const opts = {
  secretOrKey: envConfig('JWT_SECRET'),
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  options: {
    expiresIn: envConfig('JWT_EXPIRES_TIME'),
    algorithm: 'HS256'
  }
}

async function mongodbValidation(username: any, password?: any) {
  const User = getModel('User');
  const qInfo: any = { username }
  if (password) {
    qInfo.password = sha256(password);
  }
  const user = await User.findOne({
    ...qInfo,
    active: true
  });
  return user;
}

function prepareLocalStrategy() {
  passport.use(new LocalStrategy(
    async (username: string, password: string, done: any) => {
      const user = await mongodbValidation(username, password);
      if (user) {
        const payload = user.toJSON();
        delete payload.password;
        return done(null, payload);
      }
      return done(new Error('invalid user information'));
    }
  ));
}

/**
 * Middleware to verify authentication.
 * @param req Client request
 * @param res Response object
 * @param next next handler
 */
export function localAuth(req: IRequest, res: IResponse, next: IHandler) {
  passport.authenticate('local', (err: Error, user: any, _info: any) => {
    if (err) {
      return res.status(401).json(JSON_ERROR(err, {
        status: 401,
        message: err.message
      }));
    }
    const tokenPayload = {
      ...user
    };
    tokenPayload.id = tokenPayload._id;
    delete tokenPayload.password;
    delete tokenPayload.__v;
    delete tokenPayload.__v;
    delete tokenPayload._id;
    req.user = {
      ...user,
      token: jwt.sign(tokenPayload, opts.secretOrKey, opts.options as any)
    };
    next();
  })(req, res, next);
}

function prepareJWTStrategy() {
  passport.use(new JwtStrategy(opts, async (jwt_payload, done) => {
    const { username } = jwt_payload;
    const user = await mongodbValidation(username);
    if (!user) {
      return done(new Error('invalid user information'));
    }
    return done(null, jwt_payload);
  }));
}

export function prepareUserInformation(req: IRequest, res: IResponse, next: IHandler) {
  passport.authenticate('jwt', (err: Error, user: any, jwtErr: Error) => {
    if (err || jwtErr) {
      (req as any).authError = jwtErr || err;
    }
    req.user = user;
    if (!req.user) {
      req.user = {
        role: 'reader'
      };
    }
    return next();
  })(req, res, next);
}

export function checkCredentials(req: IRequest, res: IResponse, next: IHandler) {
  const err = (req as any).authError;
  if (err){
    return res.status(401).json(JSON_ERROR(err.message));
  }
  return next();
}

export function loggedIn(req: IRequest, res: IResponse, next: IHandler) {
  if (!req.user || !(req.user as any).username) {
    return res.status(403).end();
  }
  next();
}


function remapPermissions(acc: any, role: any) {
  role.methods.forEach((method: string) => {
    if (!acc[method]) {
      acc[method] = [];
    }
    role.paths.forEach((path: string) => {
      acc[method].push(new RegExp(path.trim()));
    })
  });
  return acc;
}

async function getPermissionsByRole(role: string) {
  // if (!(getPermissionsByRol as any).$cache) {
  //   (getPermissionsByRol as any).$cache = {};
  // }
  // const cache = (getPermissionsByRol as any).$cache;
  // if (cache[rol]) {
  //   return cache[rol];
  // }
  const model: Model<any> = getModel('Permissions');
  const modelsData = await model.find();
  const PERMISSIONS = modelsData.reduce((acc, doc) => {
    const json = doc.toJSON();
    acc[doc.name] = {
      extends: json.extends,
      paths: json.paths,
      methods: json.methods
    };
    return acc;
  }, {});
  const rolData = PERMISSIONS[role] || {
    extends: [],
    paths: [],
    methods: []
  };
  const partialPermissions = rolData.extends
    .map((role: string) => PERMISSIONS[role])
    .reduce(remapPermissions, {})
    ;
    const newPermissions = remapPermissions(partialPermissions, rolData);
  // cache[rol] = newPermissions;
  return newPermissions;
}

export async function acl(req: IRequest, res: IResponse, next: IHandler) {
  const { role } = req.user as any;
  if (role === 'admin') {
    return next();
  } else {
    const roleInfo = await getPermissionsByRole(role);
    const isAllowed = roleInfo && roleInfo[req.method] &&
      roleInfo[req.method].reduce((acc: boolean, re: RegExp) => {
        return acc || re.test(req.originalUrl);
      }, false);
    debug(req.method, `Access to ${req.originalUrl} from ${role}: ${isAllowed}`)
    if (!isAllowed) {
      return res.status(403).json(JSON_ERROR('Invalid role', {
        role
      }));
    }
  }
  next();
}

export function getMiddleware(): IHandler {
  prepareLocalStrategy();
  prepareJWTStrategy();
  return passport.initialize() as IHandler;
}
