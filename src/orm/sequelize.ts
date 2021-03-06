import { Injectable, Name, OrmMetadata, DatabaseMetadata, Logger, LoggerCore, ClsNamespaceService, TransactionT } from 'miter';
import { TransactionImpl } from './impl/transaction-impl';
import * as __Sequelize from 'sequelize';
import { SequelizeORMService } from '../services/sequelize-orm.service';

@Injectable()
@Name('orm')
export class Sequelize {
    constructor(
        private ormService: SequelizeORMService,
        private ormMeta: OrmMetadata,
        private dbMeta: DatabaseMetadata,
        private loggerCore: LoggerCore,
        private logger: Logger
    ) {
        this.sqlLogger = Logger.fromSubsystem(this.loggerCore, 'sql');
    }
    
    private sqlLogger: Logger;
    
    private _initialized = false;
    async init() {
        if (this._initialized) return;
        this._initialized = true;
        
        let orm = this.ormMeta;
        if (!orm.enabled || !this.dbMeta) return;
        let db = this.dbMeta!;
        
        this.sql = new __Sequelize(db.name, db.user, db.password, {
            host: db.host.domain,
            port: db.host.port,
            
            dialect: db.dialect,
            dialectOptions: {
                charset: db.charset
            },
            pool: db.pool,
            define: {
                charset: db.charset,
                collate: `${db.charset}_general_ci`
            },
            logging: (msg: string, ...extras: any[]) => this.sqlLogger.verbose(msg, ...extras)
        });
    }
    
    private sql: __Sequelize.Sequelize;
    
    async sync() {
        let recreate = (this.ormMeta.recreate) || false;
        if (recreate) {
            if ((<string>process.env.NODE_ENV || '') == 'production') throw new Error('Server launched with config value orm.recreate enabled. As a security feature, this causes a crash when NODE_ENV = production.');
            this.logger.warn(`Warning: recreating database tables. Note: this option should not be enabled in production.`);
        }
        return await this.sql.sync({force: recreate});
    }
    
    async close() {
        this.sql.close();
    }
    
    define(modelName: string, attributes: __Sequelize.DefineAttributes, options: __Sequelize.DefineOptions<{}>) {
        return this.sql.define(modelName, attributes, options);
    }
    
    get currentTransaction(): TransactionT | undefined {
        return this.ormService.currentTransaction;
    }
    set currentTransaction(val: TransactionT | undefined) {
        this.ormService.currentTransaction = val;
    }
    
    async transaction(transactionName: string, transaction?: TransactionT | null): Promise<TransactionT> {
        let parentTransaction = transaction;
        if (typeof parentTransaction === 'undefined') parentTransaction = this.currentTransaction;
        let sqlTransact = parentTransaction && (<TransactionImpl>parentTransaction).sync();
        if (!sqlTransact) sqlTransact = await this.sql.transaction();
        else sqlTransact = await this.sql.transaction(<any>{ transaction: sqlTransact }); //Sequelize typings are wrong
        
        let t = new TransactionImpl(transactionName, sqlTransact!, parentTransaction || null);
        this.currentTransaction = t;
        return t;
    }
}
