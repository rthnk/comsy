import { Schema } from 'mongoose';

export const PointSchema = new Schema({
  longitude: {
    type: Number,
    default: 0
  },
  latitude: {
    type: Number,
    default: 0
  },
},{ _id : false });

export const FileSchema = new Schema({
  path: {
    type: String,
    required: true
  }
},{ _id : false });
