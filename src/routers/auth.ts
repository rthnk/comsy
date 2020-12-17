import { Router } from 'express';
import { getModel } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { prepareUserInformation, checkCredentials, localAuth } from '../middlewares/auth';
import { IRequest, IResponse } from '../types';
import { JSON_ANSWER, JSON_ERROR, sha256 } from '../utils';
import { MailSender } from '../common/mailsender';

const authRouter: Router = Router();

authRouter.get('/check', (_req: IRequest, res: any) => {
  res.status(200).json({ status: 'OK' })
})

authRouter.head('/check', (_req: IRequest, res: any) => {
  res.status(200).end();
})

authRouter.post('/login', localAuth, (req: IRequest, res: any) => {
  res.status(200).json(JSON_ANSWER({
    status: 200,
    token: (req.user as any)?.token
  }));
});

authRouter.post('/change-password', prepareUserInformation, checkCredentials, async (req: IRequest, res: any) => {
  const user: any = req.user;
  const User = getModel('User');
  console.log({
    username: user.username,
    password_o: req.body.currentPassword,
    password: sha256(req.body.currentPassword)
  });
  const oldUser = await User.findOne({
    username: user.username,
    password: sha256(req.body.currentPassword)
  });
  if (oldUser) {
    oldUser.password = sha256(req.body.newPassword);
    await oldUser.save();
    return res.status(201).json(JSON_ANSWER({
      status: 201,
      message: 'password changed'
    }));
  }
  res.status(401).json(JSON_ERROR({
    status: 401,
    message: 'Unauthorized'
  }));
});

authRouter.post('/register', async (req: IRequest, res: IResponse) => {
  const User = getModel('User');
  const oldUser = await User.findOne({
    username: req.body.username
  });
  if (oldUser) {
    return res.status(406).json(JSON_ERROR('Invalid new user information'))
  }
  const confirm_token = uuidv4().replace(/-/g, '');
  const newUserInfo = {
    username: req.body.username,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    email: req.body.email,
    confirm_token,
    role: req.body.role === 'admin'? 'reader' : req.body.role,
    password: sha256(req.body.password)
  };
  const user = new User(newUserInfo);
  const resp = await user.save();
  const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl.replace('/register', '');
  if (req.body.email) {
    try {
      MailSender.getInstance().sendEmail(
        req.body.email,
        'New Platform User',
        `<strong>Welcome to Ciudad Latente team</strong>
        <br><br>
        <p>To confirm your account open next link</p>
        <p><a href="${fullUrl}/activate/${user.id}aha${confirm_token}">Activate</a></p>`,
      );
    } catch (error) {
      console.error(`Error sending email: ${error.message}`);
    }
  }
  res.status(201).json(JSON_ANSWER({
    status: 201,
    message: 'user created',
    user: {
      ...newUserInfo,
      _id: resp._id,
      confirm_token: undefined,
      password: undefined
    }
  }));
});

authRouter.get('/activate/:data', async (req: IRequest, res: any) => {
  const [uid, actToken] = req.params.data.split('aha');
  const User = getModel('User');
  const oldUser = await User.findOne({
    _id: uid,
    confirm_token: actToken,
  });
  if (oldUser) {
    oldUser.active = true;
    await oldUser.save();
    return res.status(200).json(JSON_ANSWER({
      status: 200,
      message: 'User is active now',
      user: req.user
    }));
  }
  res.status(401).json(JSON_ERROR('Invalid activation information'));
});

authRouter.get('/private', prepareUserInformation, checkCredentials, (req: IRequest, res: any) => {
  res.status(200).json(JSON_ANSWER({
    status: 200,
    message: 'private resource delivered',
    user: req.user
  }));
});

authRouter.head('/session-check', prepareUserInformation, checkCredentials, (_req: IRequest, res: any) => {
  res.status(200).end();
})


export default authRouter;
