import { Command } from 'commander'
import { initializeDatabase, getModel } from './database'
import { sha256 } from './utils';
import { v4 as uuidv4 } from 'uuid';
import prompts from 'prompts'

async function main() {
  const program = new Command();
  program
    .option('-a, --create-admin', 'Create admin user')
    .version('0.0.1')
    ;
  program.parse(process.argv);
  if (program.createAdmin) {
    initializeDatabase();
    console.log('Create admin user...')
    const username = await prompts({
      type: 'text',
      name: 'username',
      message: 'Your username',
    });
    const User = getModel('User');
    const oldUser = await User.findOne({
      username: username.username 
    });
    if (oldUser) {
      console.log('Username is already taken.')
      return process.exit(0);
    }
    const email = await prompts({
      type: 'text',
      name: 'email',
      message: 'Your email',
    });
    const password = await prompts({
      type: 'password',
      name: 'password',
      message: 'Your password',
    });
    const firstname = await prompts({
      type: 'text',
      name: 'firstname',
      message: 'Your first name',
    });
    const lastname = await prompts({
      type: 'text',
      name: 'lastname',
      message: 'Your last name',
    });
    console.log('Creating user...');
    const confirm_token = uuidv4().replace(/-/g, '');
    const newUserInfo = {
      username: username.username,
      firstname: firstname.firstname,
      lastname: lastname.lastname,
      email: email.email,
      confirm_token,
      role: 'admin',
      password: sha256(password.password),
      active: true,
    };
    console.log('User information ready...');
    const user = new User(newUserInfo);
    await user.save();
    console.log('User created...');
  }
  process.exit(0);
}

main();

