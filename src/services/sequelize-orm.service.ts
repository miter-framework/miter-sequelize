import { Service, Name, Logger, LoggerCore, ORMService, TransactionT, ClsNamespaceService,
         OrmMetadata, DatabaseMetadata, ModelT, PkType, StaticModelT, ModelMetadata, ModelMetadataSym,
         OrmTransformService, PropMetadata, PropMetadataSym, AssociationMetadata, ModelPropertiesSym,
         ModelHasManyAssociationsSym, HasManyMetadata, HasManyMetadataSym,
         ModelBelongsToAssociationsSym, BelongsToMetadata, BelongsToMetadataSym,
         ModelHasOneAssociationsSym, HasOneMetadata, HasOneMetadataSym,
         Injector, TransactionService, Types } from 'miter';
import { Sequelize } from '../orm/sequelize';
import { Model as SqlModel } from 'sequelize';
import { DbImpl } from '../orm/impl/db-impl';
import * as SqlTypes from '../meta/types';

type AssociationTypeDef = {
    sqlName: string,
    msgName: string,
    associationsSym: Symbol,
    metadataSym: Symbol,
    transform?: (propMeta: AssociationMetadata, propName: string) => void
};

@Service()
@Name('miter-sequelize')
export class SequelizeORMService extends ORMService {
    constructor(
        injector: Injector,
        namespace: ClsNamespaceService,
        private logger: Logger,
        private loggerCore: LoggerCore,
        private ormMeta: OrmMetadata,
        private dbMeta: DatabaseMetadata,
        private ormTransform: OrmTransformService
    ) {
        super(injector, namespace);
        this.dbImplLogger = this.loggerCore.getSubsystem('db-impl');
    }
    
    private dbImplLogger: Logger;
    private sql: Sequelize;
    
    private transactionService: TransactionService;
    
    async start() {
        this.logger.verbose(`Initializing ORM...`);
        
        await super.start();
        
        this.transactionService = this.injector.resolveInjectable(TransactionService)!;
        this.sql = this.injector.resolveInjectable(Sequelize)!;
        
        await this.sql.init();
        
        let models = this.ormMeta.models;
        this.reflectModels(models);
        this.reflectAssociations(models);
        this.createDbImpls(models);
        
        await this.sql.sync();
        
        this.logger.info(`Finished initializing ORM.`);
    }
    
    async stop() {
        await this.sql.close();
        
        await super.stop();
    }
    
    transaction(transactionName: string, transaction: TransactionT | null | undefined) {
        return this.sql.transaction(transactionName, transaction);
    }
    
    reflectModels(models: StaticModelT<ModelT<PkType>>[]) {
        for (let q = 0; q < models.length; q++) {
            this.reflectModel(models[q]);
        }
    }
    
    private models = new Map<StaticModelT<ModelT<PkType>>, SqlModel<{}, {}>>();
    private modelsByTableName = new Map<string, StaticModelT<ModelT<PkType>>>();
    reflectModel(modelFn: StaticModelT<ModelT<PkType>>) {
        if (this.models.has(modelFn)) throw new Error(`A model was passed to the orm-reflector twice: ${modelFn.name || modelFn}.`);
        let modelProto = modelFn.prototype;
        
        let meta: ModelMetadata = Reflect.getOwnMetadata(ModelMetadataSym, modelProto);
        if (!meta) throw new Error(`Expecting class with @Model decorator, could not reflect model properties for ${modelProto}.`);
        let modelOptions = meta;
        modelOptions = this.ormTransform.transformModel(modelOptions) || modelOptions;
        
        modelOptions.tableName = modelOptions.tableName || this.ormTransform.transformModelName(modelFn.name) || modelFn.name;
        Reflect.defineMetadata(ModelMetadataSym, modelOptions, modelProto);
        
        let dupTable = this.modelsByTableName.get(modelOptions.tableName);
        if (dupTable) throw new Error(`Defining multiple models with the same table name! ${dupTable.name || dupTable} and ${modelFn.name || modelFn}`);
        this.modelsByTableName.set(modelOptions.tableName, modelFn);
        
        let columns: any = {};
        let props: string[] = Reflect.getOwnMetadata(ModelPropertiesSym, modelProto) || [];
        for (let q = 0; q < props.length; q++) {
            let propName: string = props[q];
            let propMeta: PropMetadata = Reflect.getOwnMetadata(PropMetadataSym, modelProto, propName);
            if (!propMeta) throw new Error(`Could not find model property metadata for property ${modelFn.name || modelFn}.${propName}.`);
            
            let columnMeta = propMeta;
            columnMeta = this.ormTransform.transformColumn(columnMeta) || columnMeta;
            (<any>columnMeta).field = columnMeta.columnName || this.ormTransform.transformColumnName(propName) || propName;
            (<any>columnMeta).miterType = columnMeta.type;
            columnMeta.type = <any>this.translateColumnType(columnMeta);
            Reflect.defineMetadata(PropMetadataSym, columnMeta, modelProto, propName)
            
            columns[propName] = columnMeta;
        }
        
        let model = this.sql.define(modelOptions.tableName, columns, modelOptions);
        this.models.set(modelFn, <any>model);
    }
    private translateColumnType(meta: PropMetadata) {
        let metaType = meta.type!;
        switch (metaType) {
        case Types.string:
            return SqlTypes.STRING;
        case Types.text:
            return SqlTypes.TEXT;
        case Types.integer:
            return SqlTypes.INTEGER;
        case Types.bigint:
            return SqlTypes.BIGINT;
        case Types.float:
            return SqlTypes.FLOAT;
        case Types.real:
            return SqlTypes.REAL;
        case Types.double:
            return SqlTypes.DOUBLE;
        case Types.decimal:
            return SqlTypes.DECIMAL;
        case Types.date:
            return SqlTypes.DATE;
        case Types.dateonly:
            return SqlTypes.DATEONLY;
        case Types.boolean:
            return SqlTypes.BOOLEAN;
        case Types.enum:
            if (!meta.enumValues || !meta.enumValues.length) throw new Error(`Can't use the enum column type without defining enumValues.`);
            return SqlTypes.ENUM(meta.enumValues);
        case Types.uuid:
            return SqlTypes.UUID;
        case Types.virtual:
            return SqlTypes.VIRTUAL;
        
        //PostgreSQL only:
        case Types.array:
            this.assertIsPostgreSQL(`The ${metaType} column type is only available in PostgreSQL.`);
            return SqlTypes.ARRAY;
        case Types.json:
            this.assertIsPostgreSQL(`The ${metaType} column type is only available in PostgreSQL.`);
            return SqlTypes.JSON;
        case Types.jsonb:
            this.assertIsPostgreSQL(`The ${metaType} column type is only available in PostgreSQL.`);
            return SqlTypes.JSONB;
        case Types.blob:
            this.assertIsPostgreSQL(`The ${metaType} column type is only available in PostgreSQL.`);
            return SqlTypes.BLOB;
        case Types.range:
            this.assertIsPostgreSQL(`The ${metaType} column type is only available in PostgreSQL.`);
            return SqlTypes.RANGE;
        case Types.geometry:
            this.assertIsPostgreSQL(`The ${metaType} column type is only available in PostgreSQL.`);
            return SqlTypes.GEOMETRY;
            
        default:
            throw new Error(`Unknown column type: ${metaType}`);
        }
    }
    private assertIsPostgreSQL(error: string) {
        if (!this.dbMeta) throw new Error(`No database configuration found. What gives?`);
        let dialect = this.dbMeta.dialect;
        if (dialect !== 'postgres') throw new Error(error);
    }
    
    private reflectAssociations(models: StaticModelT<ModelT<PkType>>[]) {
        for (let q = 0; q < models.length; q++) {
            this.reflectModelAssociations(models[q]);
        }
    }
    
    private reflectModelAssociations(modelFn: StaticModelT<ModelT<PkType>>) {
        let model = this.models.get(modelFn);
        if (!model) throw new Error(`Could not reflect model associations for a model that failed to be reflected: ${modelFn.name || modelFn}.`);
        let modelProto = modelFn.prototype;
        
        let meta: ModelMetadata = Reflect.getOwnMetadata(ModelMetadataSym, modelProto);
        if (!meta) throw new Error(`Expecting class with @Model decorator, could not reflect model properties for ${modelProto}.`);
        
        let associationTypes: AssociationTypeDef[] = [
            {
                sqlName: 'hasMany',
                msgName: 'has-many',
                associationsSym: ModelHasManyAssociationsSym,
                metadataSym: HasManyMetadataSym,
                transform: (propMeta: HasManyMetadata, propName: string) => {
                    
                }
            },
            {
                sqlName: 'belongsTo',
                msgName: 'belongs-to',
                associationsSym: ModelBelongsToAssociationsSym,
                metadataSym: BelongsToMetadataSym,
                transform: (propMeta: BelongsToMetadata, propName: string) => {
                    propMeta.foreignKey = propMeta.foreignKey || this.ormTransform.transformAssociationColumnName(propName) || propName;
                }
            },
            {
                sqlName: 'hasOne',
                msgName: 'has-one',
                associationsSym: ModelHasOneAssociationsSym,
                metadataSym: HasOneMetadataSym,
                transform: (propMeta: HasOneMetadata, propName: string) => {
                    
                }
            }
        ];
        
        for (let q = 0; q < associationTypes.length; q++) {
            let def = associationTypes[q];
            let associationNames = Reflect.getOwnMetadata(def.associationsSym, modelProto) || [];
            for (let w = 0; w < associationNames.length; w++) {
                let propName = associationNames[w];
                let propMeta: AssociationMetadata = Reflect.getOwnMetadata(def.metadataSym, modelProto, propName);
                if (!propMeta) throw new Error(`Could not find model ${def.msgName} metadata for property ${modelFn.name || modelFn}.${propName}`);
                
                let foreignModelFn = this.resolveForeignModelFn(propMeta);
                if (!foreignModelFn) throw new Error(`Could not resolve foreign model for ${def.msgName} association ${modelFn.name || modelFn}.${propName}`);
                let foreignModel = this.models.get(foreignModelFn);
                if (!foreignModel) throw new Error(`Could not create ${def.msgName} association ${modelFn.name || modelFn}.${propName} to model that has not been reflected: ${foreignModelFn.name || foreignModelFn}`);
                
                let sqlMeta = propMeta;
                sqlMeta = this.ormTransform.transformAssociation(sqlMeta) || sqlMeta;
                if (def.transform) def.transform(sqlMeta, propName);
                Reflect.defineMetadata(def.metadataSym, sqlMeta, modelProto, propName);
                
                (<any>model)[def.sqlName](foreignModel, sqlMeta);
            }
        }
    }
    
    private createDbImpls(models: StaticModelT<ModelT<any>>[]) {
        for (let q = 0; q < models.length; q++) {
            let modelFn = models[q];
            let model = this.models.get(modelFn);
            if (!model) throw new Error(`Could not reflect model associations for a model that failed to be reflected: ${modelFn.name || modelFn}.`);
            let db = new DbImpl(modelFn, model, this.sql, this.dbImplLogger, this.transactionService);
            modelFn.db = db;
        }
    }
    
    private isStaticModelT(test: any): test is StaticModelT<ModelT<any>> {
        return test && !!(<any>test).db;
    }
    private isTableNameRef(test: any): test is { tableName: string } {
        return test.tableName;
    }
    private isModelNameRef(test: any): test is { modelName: string } {
        return test.modelName;
    }
    private resolveForeignModelFn(meta: AssociationMetadata): StaticModelT<ModelT<any>> | undefined {
        let fmod = meta.foreignModel;
        if (!fmod) return undefined;
        if (this.isStaticModelT(fmod)) return fmod;
        if (typeof fmod === 'function') return meta.foreignModel = fmod();
        else if (this.isTableNameRef(fmod)) return meta.foreignModel = this.modelsByTableName.get(fmod.tableName);
        else if (this.isModelNameRef(fmod)) {
            let modelName = fmod.modelName;
            return meta.foreignModel = [...this.models.keys()].find(model => model.name == modelName);
        }
    }
}
