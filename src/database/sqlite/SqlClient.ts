export type SqlValue = string | number | null;

export interface SqlRow {
  [column: string]: SqlValue;
}

export interface SqlResult<T extends SqlRow = SqlRow> {
  rows: T[];
  rowsAffected: number;
}

export interface SqlClient {
  execute<T extends SqlRow = SqlRow>(sql: string, params?: SqlValue[]): Promise<SqlResult<T>>;
  transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T>;
}
