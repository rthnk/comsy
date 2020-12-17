import { Schema, model } from 'mongoose';
import { titleCase } from '../utils';
import { updateModel, deleteModel, generateModelFromSchema } from './index';

export const CollectionsSchema = new Schema({
  name:  {
    type: String,
    required: true,
    unique: true
  },
  label:  {
    type: String,
    required: false,
  },
  category:  {
    type: String,
    required: false,
  },
  icon:  {
    type: String,
    required: false,
    uiMeta: {
      uiField: 'icon'
    }
  },
  allowed_for:  {
    type: [String],
    required: false,
    uiMeta: {
      uiField: 'stringarray'
    }
  },
  schema_structure:  {
    type: String,
    uiMeta: {
      uiField: 'json',
    },
    required: true
  }
});

CollectionsSchema.pre('remove', function(this: any) {
  const modelname = titleCase(this.name);
  deleteModel(modelname);
});
                                                                                                 
CollectionsSchema.pre('save', async function(this: any, next: any) {                             
  this.name = titleCase(this.name);                                                              
  const modelname = this.name;                                                                   
  try {                                                                                          
    if (!this.isNew) {                                                                        
      await updateModel(modelname);
    } else {
      await generateModelFromSchema(this)
    }
  } catch(error) {
    console.log(error);
  }
  next();
});

export const Collections = model('Collections', CollectionsSchema);
