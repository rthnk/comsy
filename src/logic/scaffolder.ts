import { plural } from 'pluralize';
import { Router } from 'express';
import { Model, mongo } from 'mongoose';
import { getModel } from '../database';
import { DataBaseError, IRequest, IResponse } from '../types';
import { addInfo, debug, JSON_ANSWER, JSON_ERROR, makeAWSFileLink, sha256 } from '../utils';
import { FileSchema } from '../database/common';
import { acl, prepareUserInformation } from '../middlewares/auth';

function getUiField(fieldInfo: any) {
  if (fieldInfo.type) {
    const partial: string = fieldInfo.type.name || fieldInfo.type.constructor.name;
    const value = partial.toLowerCase() === 'string' ? 'text' : partial.toLowerCase();
    if (value) {
      return value;
    }
  } 
  return 'text'
}

const getFieldType = (field: string, fieldInfo: any): any => {
  const enumOptions = fieldInfo.enum;
  const uiMeta = fieldInfo.uiMeta || {};
  if (Array.isArray(fieldInfo) && fieldInfo[0]) {
    return {
      ...getFieldType(field, fieldInfo[0]),
      required: fieldInfo[0].required,
      enum: enumOptions,
      uiMeta: {
        ...uiMeta,
        uiField: uiMeta.uiField || getUiField(fieldInfo) || getUiField(fieldInfo[0]),
        isArray: true,
      },
    };
  } else if (fieldInfo.type) {
    if (fieldInfo.type.constructor.name === 'Array') {
      return {
        type: fieldInfo.type[0].name || fieldInfo.type.constructor.name,
        isArray: true,
        enum: enumOptions,
        required: fieldInfo.required,
        uiMeta: {
          ...uiMeta,
          uiField: uiMeta.uiField || getUiField(fieldInfo) || getUiField(fieldInfo[0]),
          isArray: true,
        },
      }
    } else if (fieldInfo.type.constructor.name === 'Schema') {
        return {
          isArray: false,
          enum: enumOptions,
          required: fieldInfo.required,
          uiMeta: {
            ...uiMeta,
            uiField: uiMeta.uiField || getUiField(fieldInfo),
          },
        }
    } else {
      return {
        type: fieldInfo.type.name || fieldInfo.type.constructor.name,
        required: fieldInfo.required,
        isArray: false,
        enum: enumOptions,
        uiMeta: {
          ...uiMeta,
          uiField: uiMeta.uiField || getUiField(fieldInfo),
        },
      };
    }
  } else {
    return {
      type: 'String',
      isArray: false,
      uiMeta: {
        ...uiMeta,
        uiField: uiMeta.uiField || getUiField(fieldInfo),
      },
    };
  }
}

const getTypes = (object: any) => (acc: any, field: string) => {
  const fieldInfo: any = object[field];
  if (fieldInfo.editable !== false) {
    acc['fullFields'][field] = getFieldType(field, fieldInfo);
  } else {
    acc['noEditableFields'][field] = getFieldType(field, fieldInfo);
  }
  return acc;
}

export function scaffoldModel(modelName: String) {
  const modelname = modelName.toLowerCase();
  const resource = plural(modelname);
  const model: Model<any> = getModel(modelName);
  const fields = Object.keys(model.schema.obj);
  const {fullFields, noEditableFields} = Object.keys(model.schema.obj).reduce(getTypes(model.schema.obj), {fullFields:{}, noEditableFields:{}});
  const requiredFields = fields.filter(field => model.schema.obj[field].required);
  const fileFields = fields.filter(field => model.schema.obj[field]?.type === FileSchema);
  const encriptedFields = fields.filter(field => model.schema.obj[field]?.encripted);
  const crudMeta = {
    model: {
      name: modelname,
      plural: resource
    }
  };
  const RE_RE = /^re\((.+)\)$/
  const router = Router();
  addInfo('resources', resource);
  async function getItems(req: IRequest, res: IResponse) {
    try {
      const args: any = req.query;
      let projection = {}
      if (args.$project) {
        projection = args.$project.
          split(',')
          .map((x: string) => x.trim())
          .reduce((acc: any, item: string) => {
            acc[item] = 1;
            return acc;
          }, {_id: 0});
          delete args.$project;
      }
      const query = {
        ...(Object as any).fromEntries(Object.entries(args).map((entry: any[]) => {
          let res;
          try {
            const reMatch = entry[1].match(RE_RE);
            const pos0: string = entry[1].substring(0, 1);
            if (reMatch) {
              res = [entry[0], new RegExp(reMatch[1])];
            } else if(['{', '['].includes(pos0)) {
              res = [entry[0], JSON.parse(entry[1])];
            } else {
              res = entry;
            }
          } catch (error) {
            console.log(error)
            res = entry;
          }
          return res;
        })),
      };
      const colectionCount = await model.countDocuments(query);
      if (colectionCount > 1500) {
        return res.status(400).send(JSON_ERROR('A lot of information, you need to use a paginable endpoint.'))
      }
      const dbValues = await model.find(query, projection);
      const user: any = req.user;
      const values = dbValues.map((value) => {
        if (user.role !== 'admin') {
          encriptedFields.forEach(field => {
            value[field] = undefined;
          });
        }
        return value;
      });
      return res.status(200).json(JSON_ANSWER({
        count: values.length,
        values
      }, crudMeta));
    } catch (error) {
      debug(error);
    }
    res.status(404).json(JSON_ERROR(`Can't get elements from ${resource}`))
  }
  async function getPaginatedItems(req: IRequest, res: IResponse) {
    try {
      const args: any = req.query;
      let projection = {}
      if (args.$project) {
        projection = args.$project.
          split(',')
          .map((x: string) => x.trim())
          .reduce((acc: any, item: string) => {
            acc[item] = 1;
            return acc;
          }, {_id: 0});
          delete args.$project;
      }
      const page = !args.page ? 0 : parseInt(args.page, 10) - 1;
      const pageCount = parseInt(args.pageCount, 10) || 100;
      const skip = pageCount * page;
      if (pageCount > 100) {
        res.status(406).json(JSON_ERROR(`Can't get that number of elements from ${resource}`))
      }
      const query = {
        ...(Object as any).fromEntries(Object.entries(args).map((entry: any[]) => {
          let res;
          try {
            const reMatch = entry[1].match(RE_RE);
            const pos0: string = entry[1].substring(0, 1);
            if (reMatch) {
              res = [entry[0], new RegExp(reMatch[1])];
            } else if(['{', '['].includes(pos0)) {
              res = [entry[0], JSON.parse(entry[1])];
            } else {
              res = entry;
            }
          } catch (error) {
            res = entry;
          }
          return res;
        })),
        page: undefined,
        pageCount: undefined
      }
      const colectionCount = await model.countDocuments(query);
      const pages = Math.ceil(colectionCount / pageCount);
      if (page > pages) {
        return res.status(200).json(JSON_ANSWER({
          itemsPerPage: pageCount,
          page: page + 1,
          pages,
          count: 0,
          totalCount: colectionCount,
          values: [],
        }, crudMeta));
      }
      const dbValues = await model.find(query, projection)
        .sort({ created: -1 })
        .skip(skip)
        .limit(pageCount);
      const user: any = req.user;
      const values = dbValues.map((value) => {
        if (user.role !== 'admin') {
          encriptedFields.forEach(field => {
            value[field] = undefined;
          });
        }
        return value;
      });
      return res.status(200).json(JSON_ANSWER({
        itemsPerPage: pageCount,
        page: page + 1,
        pages,
        totalCount: colectionCount,
        count: values.length,
        values,
      }, crudMeta));
    } catch (error) {
      debug(error);
    }
    res.status(404).json(JSON_ERROR(`Can't get elements from ${resource}`))
  }
  async function getItem(req: IRequest, res: IResponse) {
    try {
      const value = await model.findOne({
        _id: new mongo.ObjectId(req.params.id)
      });
      const user: any = req.user;
      if (user.role !== 'admin') {
        encriptedFields.forEach(field => {
          value[field] = undefined;
        });
      }
      if (value) {
        return res.status(200).json(JSON_ANSWER({
          value
        }, crudMeta));
      }
    } catch (error) {
      debug(error);
    }
    res.status(404).json(JSON_ERROR(`${modelname} with id '${req.params.id}' was not found`))
  }
  async function createItem(req: IRequest, res: IResponse) {
    try {
      requiredFields.forEach(field => {
        if (!req.body[field]) {
          throw new DataBaseError(`Required field '${field}' was not provided.`);
        }
      });
      const newObj: any = {};
      fields.forEach(field => newObj[field] = req.body[field]);
      const pendings = fileFields.map(async field => {
        if (req.body[field]) {
          newObj[field] = {
            path: await makeAWSFileLink(req.body[field], model.schema.obj[field].target)
          }
        }
      });
      await Promise.all(pendings);
      encriptedFields.map(field => {
        if (req.body[field]) {
          newObj[field] = sha256(req.body[field]);
        }
      });
      const instance = new model(newObj);
      const savedInstance = await instance.save();
      return res.status(201).json(JSON_ANSWER({
        status: 201,
        message: 'created',
        [modelname]: savedInstance
      }, crudMeta));
    } catch (error) {
      if (error.name === 'DatabaseError') {
        return res.status(406).json(JSON_ERROR(error.message));
      } else if (error.name === 'ValidationError') {
        const [errMsg, fieldName] = error.message.split(':');
        const field = fieldName.trim();
        return res.status(406).json(JSON_ERROR(`${errMsg}: ${field} can't accept the value '${req.body[field]}'`));
      }
      debug(error);
      res.status(406).json(JSON_ERROR(`Error saving ${modelname}`));
    }
  }
  async function updateItem(req: IRequest, res: IResponse) {
    try {
      const instance = await model.findOne({
        _id: new mongo.ObjectId(req.params.id)
      });
      if (!instance) {
        return res.status(404).json(JSON_ANSWER({
          status: 404,
          message: `${modelname} with ID ${req.params.id} was not found`
        }, crudMeta));
      }
      encriptedFields.map(field => {
        if (instance[field] !== req.body[field]) {
          req.body[field] = sha256(req.body[field]);
        }
      });
      fields.forEach(field => {
        if (instance[field] !== req.body[field]) {
          instance[field] = req.body[field];
        }
      })
      const pendings = fileFields.map(async field => {
        if (req.body[field]) {
          instance[field] = {
            path: await makeAWSFileLink(req.body[field])
          }
        }
      });
      await Promise.all(pendings);
      const savedInstance = await instance.save();
      return res.status(201).json(JSON_ANSWER({
        status: 202,
        message: 'accepted',
        [modelname]: savedInstance.toJSON()
      }, crudMeta));
    } catch (error) {
      debug('Error:', error);
      if (error.name === 'DatabaseError') {
        return res.status(404).json(JSON_ERROR(error.message));
      }
    }
    res.status(404).json(JSON_ERROR(`${modelname} with id '${req.params.id}' was not found`))
  }
  async function deleteItem(req: IRequest, res: IResponse) {
    try {
      const instance = await model.findOne({
        _id: new mongo.ObjectId(req.params.id)
      });
      if (instance) {
        const deleted = await instance.delete();
        return res.status(202).json(JSON_ANSWER({
          status: 202,
          message: `${modelname} with ID ${deleted._id} was deleted`
        }, crudMeta));
      }
      res.status(404).json(JSON_ERROR(`${modelname} with id '${req.params.id}' was not found`))
    } catch (error) {
      
    }
  }
  function getFields(req: IRequest, res: IResponse) {
    const user: any = req.user;
    let fields = fullFields;
    if (user && user.role === 'admin') {
      fields = {
        ...fullFields,
        ...noEditableFields
      }
    }
    res.status(200).json(JSON_ANSWER({
      fields
    }))
  }
  const middlewares: any[] = [
    prepareUserInformation,
    acl
  ];
  router.get.apply(router, [`/resources/${resource}`, ...middlewares, getFields]  as any);
  router.get.apply(router, [`/${resource}`, ...middlewares, getItems]  as any);
  router.get.apply(router, [`/${resource}/paginated`, ...middlewares, getPaginatedItems]  as any);
  router.get.apply(router, [`/${resource}/:id`, ...middlewares, getItem]  as any);
  router.post.apply(router, [`/${resource}/`, ...middlewares, createItem]  as any);
  router.put.apply(router, [`/${resource}/:id`, ...middlewares, updateItem]  as any);
  router.delete.apply(router, [`/${resource}/:id`, ...middlewares, deleteItem]  as any);

  return router;

}
