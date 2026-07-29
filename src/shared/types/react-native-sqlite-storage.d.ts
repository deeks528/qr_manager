declare module 'react-native-sqlite-storage' {
  export type SQLiteValue = string | number | null;

  export interface ResultSetRowList {
    length: number;
    item(index: number): Record<string, SQLiteValue>;
  }

  export interface ResultSet {
    rows: ResultSetRowList;
    rowsAffected: number;
  }

  export interface SQLiteDatabase {
    executeSql(sql: string, params?: SQLiteValue[]): Promise<[ResultSet]>;
  }

  interface OpenDatabaseOptions {
    name: string;
    location: 'default' | string;
  }

  interface SQLiteStatic {
    enablePromise(enabled: boolean): void;
    openDatabase(options: OpenDatabaseOptions): Promise<SQLiteDatabase>;
  }

  const SQLite: SQLiteStatic;
  export default SQLite;
}
