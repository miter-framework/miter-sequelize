import { StaticModelT, ModelT, PkType, LoggerCore, ClsNamespaceService, TransactionT } from 'miter';
import { Sequelize } from '../sequelize';
import { FakeTransaction } from '../impl/test/fake-transaction';
import * as __Sequelize from 'sequelize';

export class FakeSequelize extends Sequelize {
    constructor(core: LoggerCore, clsNamespace: ClsNamespaceService, ...models: StaticModelT<ModelT<any>>[]) {
        super(<any>{
            enabled: true,
            models: [...models],
            recreate: false
        }, core, core.getSubsystem('orm'), clsNamespace);
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
