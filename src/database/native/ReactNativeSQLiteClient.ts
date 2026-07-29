import SQLite, { ResultSet, SQLiteDatabase } from 'react-native-sqlite-storage';

import { SqlClient, SqlResult, SqlRow, SqlValue } from '@database/sqlite/SqlClient';

export class ReactNativeSQLiteClient implements SqlClient {
  constructor(private readonly database: SQLiteDatabase) {}

  static async open(databaseName = 'universal_qr_profiles.db'): Promise<ReactNativeSQLiteClient> {
    SQLite.enablePromise(true);
    const database = await SQLite.openDatabase({ name: databaseName, location: 'default' });
    await database.executeSql('PRAGMA foreign_keys = ON');
    return new ReactNativeSQLiteClient(database);
  }

  async execute<T extends SqlRow = SqlRow>(sql: string, params: SqlValue[] = []): Promise<SqlResult<T>> {
    const [result] = await this.database.executeSql(sql, params);
    return mapResult<T>(result);
  }

  async transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
    await this.execute('BEGIN IMMEDIATE TRANSACTION');

    try {
      const result = await work(this);
      await this.execute('COMMIT');
      return result;
    } catch (error: unknown) {
      await this.execute('ROLLBACK');
      throw error;
    }
  }
}

function mapResult<T extends SqlRow>(result: ResultSet): SqlResult<T> {
  const rows: T[] = [];

  for (let index = 0; index < result.rows.length; index += 1) {
    rows.push(result.rows.item(index) as T);
  }

  return {
    rows,
    rowsAffected: result.rowsAffected,
  };
}
