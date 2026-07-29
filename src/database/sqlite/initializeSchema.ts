import { SqlClient } from '@database/sqlite/SqlClient';

export function splitSqlStatements(schemaSql: string): string[] {
  return schemaSql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function initializeSchema(client: SqlClient, schemaSql: string): Promise<void> {
  await client.transaction(async (transactionClient) => {
    for (const statement of splitSqlStatements(schemaSql)) {
      await transactionClient.execute(statement);
    }
  });
}
