import { join } from 'path';
import { Router, static as Static } from 'express';

const clientRouter: Router = Router();
const staticsFolder = join(__dirname, '..', '..', 'admin', 'dist');
clientRouter.use(Static(staticsFolder))

export default clientRouter;
