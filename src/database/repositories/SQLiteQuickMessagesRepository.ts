import { QuickMessagesRepository } from '@database/repositories/QuickMessagesRepository';
import { SqlClient, SqlRow } from '@database/sqlite/SqlClient';
import { QuickMessage } from '@domain/models/QuickMessage';

interface QuickMessageRow extends SqlRow {
  id: string;
  text: string;
  sortOrder: number;
}

const DEFAULT_MESSAGES = ['Groceries', 'Bill', 'Rent', 'Food', 'Shopping'];

export class SQLiteQuickMessagesRepository implements QuickMessagesRepository {
  constructor(private readonly db: SqlClient) {}

  async getMessages(): Promise<QuickMessage[]> {
    const result = await this.db.execute<QuickMessageRow>(
      'SELECT id, text, sortOrder FROM quick_messages ORDER BY sortOrder ASC',
    );

    if (result.rows.length === 0) {
      return this.seedDefaultMessages();
    }

    return result.rows.map((row) => ({
      id: row.id,
      text: row.text,
      sortOrder: row.sortOrder,
    }));
  }

  private async seedDefaultMessages(): Promise<QuickMessage[]> {
    return this.db.transaction(async (client) => {
      const messages: QuickMessage[] = [];
      for (let i = 0; i < DEFAULT_MESSAGES.length; i++) {
        const msg: QuickMessage = {
          id: `qm-${Date.now()}-${i}`,
          text: DEFAULT_MESSAGES[i],
          sortOrder: i,
        };
        await client.execute(
          'INSERT INTO quick_messages (id, text, sortOrder) VALUES (?, ?, ?)',
          [msg.id, msg.text, msg.sortOrder],
        );
        messages.push(msg);
      }
      return messages;
    });
  }

  async addMessage(text: string): Promise<QuickMessage> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Quick message text cannot be empty');
    }

    const currentMessages = await this.getMessages();
    const nextSortOrder = currentMessages.length > 0
      ? Math.max(...currentMessages.map((m) => m.sortOrder)) + 1
      : 0;

    const newMessage: QuickMessage = {
      id: `qm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: trimmed,
      sortOrder: nextSortOrder,
    };

    await this.db.execute(
      'INSERT INTO quick_messages (id, text, sortOrder) VALUES (?, ?, ?)',
      [newMessage.id, newMessage.text, newMessage.sortOrder],
    );

    return newMessage;
  }

  async updateMessage(id: string, text: string): Promise<QuickMessage> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Quick message text cannot be empty');
    }

    await this.db.execute(
      'UPDATE quick_messages SET text = ? WHERE id = ?',
      [trimmed, id],
    );

    const result = await this.db.execute<QuickMessageRow>(
      'SELECT id, text, sortOrder FROM quick_messages WHERE id = ?',
      [id],
    );

    if (!result.rows[0]) {
      throw new Error(`Quick message not found: ${id}`);
    }

    return {
      id: result.rows[0].id,
      text: result.rows[0].text,
      sortOrder: result.rows[0].sortOrder,
    };
  }

  async deleteMessage(id: string): Promise<void> {
    await this.db.execute('DELETE FROM quick_messages WHERE id = ?', [id]);
  }

  async reorderMessages(messageIds: string[]): Promise<QuickMessage[]> {
    return this.db.transaction(async (client) => {
      for (let i = 0; i < messageIds.length; i++) {
        await client.execute(
          'UPDATE quick_messages SET sortOrder = ? WHERE id = ?',
          [i, messageIds[i]],
        );
      }

      const result = await client.execute<QuickMessageRow>(
        'SELECT id, text, sortOrder FROM quick_messages ORDER BY sortOrder ASC',
      );

      return result.rows.map((row) => ({
        id: row.id,
        text: row.text,
        sortOrder: row.sortOrder,
      }));
    });
  }
}
