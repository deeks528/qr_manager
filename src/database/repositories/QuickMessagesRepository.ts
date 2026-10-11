import { QuickMessage } from '@domain/models/QuickMessage';

export interface QuickMessagesRepository {
  getMessages(): Promise<QuickMessage[]>;
  addMessage(text: string): Promise<QuickMessage>;
  updateMessage(id: string, text: string): Promise<QuickMessage>;
  deleteMessage(id: string): Promise<void>;
  reorderMessages(messageIds: string[]): Promise<QuickMessage[]>;
}
