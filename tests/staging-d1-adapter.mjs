import {DatabaseSync} from 'node:sqlite';
export class SQLiteD1 {
 constructor(path=':memory:'){this.db=new DatabaseSync(path);this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;');}
 prepare(sql){const owner=this;return {sql,values:[],bind(...values){return {...this,values:values.map(value=>value instanceof ArrayBuffer?new Uint8Array(value):value)};},async first(){return owner.db.prepare(this.sql).get(...this.values)??null;},async all(){return {results:owner.db.prepare(this.sql).all(...this.values)};},async run(){const result=owner.db.prepare(this.sql).run(...this.values);return {success:true,meta:{changes:Number(result.changes)}};}};}
 async batch(statements){this.beforeBatch?.();this.db.exec('BEGIN IMMEDIATE');try{const results=[];for(const s of statements){const r=this.db.prepare(s.sql).run(...s.values);results.push({success:true,meta:{changes:Number(r.changes)}});}this.db.exec('COMMIT');return results;}catch(error){this.db.exec('ROLLBACK');throw error;}}
 close(){this.db.close();}
}
