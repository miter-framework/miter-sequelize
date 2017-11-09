import { Service, Name, Logger, LoggerCore, ORMService, TransactionT } from 'miter';
import { Sequelize } from '../orm/sequelize';

@Service()
@Name('miter-sequelize')
export class SequelizeORMService extends ORMService {
    constructor(
        private logger: Logger,
        private loggerCore: LoggerCore,
        private sql: Sequelize
    ) {
        super();
        this.dbImplLogger = this.loggerCore.getSubsystem('db-impl');
    }
    
    private dbImplLogger: Logger;
    
    async start() {
        this.logger.verbose(`Initializing ORM...`);
        await this.sql.init();
        
        let models = this.ormMeta.models;
        this.reflectModels(models);
        this.reflectAssociations(models);
        this.createDbImpls(models);
        
        await this.sql.sync();
        this.logger.info(`Finished initializing ORM.`);
    }
    
    async stop() {
        
    }
    
    get currentTransaction(): TransactionT | undefined {
        return this.sql.currentTransaction;
    }
    set currentTransaction(value: TransactionT | undefined) {
        this.sql.currentTransaction = value;
    }
    
    transaction(transactionName: string, transaction: TransactionT | null | undefined) {
        return this.sql.transaction(transactionName, transaction);
    }
}
