import { Schema, model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export const UserSchema = new Schema({
  username:  {
    type: String,
    required: true
  },
  password:  {
    type: String,
    required: false,
    editable: false,
    encripted: true
  },
  firstname:  String,
  lastname:  String,
  email:  String,
  confirm_token:  {
    type: String,
    default: () => uuidv4().replace(/-/g, '')
  },
  role: {
    type: String,
    default: 'reader'
  },
  active: {
    type: Boolean,
    default: false
  }
});

export const User = model('Users', UserSchema);
