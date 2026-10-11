import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDependencies } from '@app/providers/DependenciesProvider';
import { QuickMessage } from '@domain/models/QuickMessage';

export const quickMessagesQueryKey = ['quick_messages'] as const;

export function useQuickMessages() {
  const { quickMessagesRepository } = useDependencies();

  return useQuery<QuickMessage[]>({
    queryKey: quickMessagesQueryKey,
    queryFn: () => quickMessagesRepository.getMessages(),
  });
}

export function useAddQuickMessage() {
  const queryClient = useQueryClient();
  const { quickMessagesRepository } = useDependencies();

  return useMutation<QuickMessage, Error, string>({
    mutationFn: (text: string) => quickMessagesRepository.addMessage(text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quickMessagesQueryKey });
    },
  });
}

export function useUpdateQuickMessage() {
  const queryClient = useQueryClient();
  const { quickMessagesRepository } = useDependencies();

  return useMutation<QuickMessage, Error, { id: string; text: string }>({
    mutationFn: ({ id, text }) => quickMessagesRepository.updateMessage(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quickMessagesQueryKey });
    },
  });
}

export function useDeleteQuickMessage() {
  const queryClient = useQueryClient();
  const { quickMessagesRepository } = useDependencies();

  return useMutation<void, Error, string>({
    mutationFn: (id: string) => quickMessagesRepository.deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quickMessagesQueryKey });
    },
  });
}

export function useReorderQuickMessages() {
  const queryClient = useQueryClient();
  const { quickMessagesRepository } = useDependencies();

  return useMutation<QuickMessage[], Error, string[]>({
    mutationFn: (ids: string[]) => quickMessagesRepository.reorderMessages(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quickMessagesQueryKey });
    },
  });
}
