import { Schema, model } from 'mongoose';

export const PermissionsSchema = new Schema({
  // role name
  name:  {
    type: String,
    required: true
  },
  extends: {
    type: [String],
    required: false,
    uiMeta: {
      uiField: 'select',
      linkedWith: 'permissions',
      keyLabel: {key: 'name', label: 'name'}
    }
  },
  paths: {
    type: [String],
    required: true,
    uiMeta: {
      uiField: 'stringarray'
    }
  },
  methods: {
    type: [String],
    required: true,
    uiMeta: {
      // uiField: 'stringarray'
    },
    enum: [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'HEAD',
      'PATCH',
    ]
  },
});

export const Permissions = model('Permissions', PermissionsSchema);
