import { StaticModelT, ModelT, PkType, LoggerCore, ClsNamespaceService, TransactionT } from 'miter';
import { Sequelize } from '../sequelize';
import * as __Sequelize from 'sequelize';
import { SequelizeORMService } from '../../services/sequelize-orm.service';
import { FakeTransaction } from '../impl/test/fake-transaction';

export class FakeSequelize extends Sequelize {
    constructor(
        ormService: SequelizeORMService,
        core: LoggerCore,
        ...models: StaticModelT<ModelT<any>>[]
    ) {
        super(ormService, <any>{
            enabled: true,
            models: [...models],
            recreate: false
        }, <any>null, core, core.getSubsystem('orm'));
    }
    
    async init() { }
    
    async sync() { }
    
    define(modelName: string, attributes: __Sequelize.DefineAttributes, options: __Sequelize.DefineOptions<{}>): __Sequelize.Model<{}, {}> {
        throw new Error(`Invalid operation on FakeSequelize: I don't know how to define models!`);
    }
    
    async transaction(transactionName: string, transaction?: TransactionT): Promise<TransactionT> {
        let parentTransaction = transaction;
        if (typeof parentTransaction === 'undefined') parentTransaction = this.currentTransaction;
        let t = new FakeTransaction(transactionName, parentTransaction);
        this.currentTransaction = t;
        return t;
    }
}
