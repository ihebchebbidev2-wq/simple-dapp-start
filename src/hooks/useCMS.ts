import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrapApiList, type ApiResponse } from '@/lib/api';
import { CMSContent } from '@/contexts/CMSContext';

const CMS_QUERY_KEYS = {
  all: ['cms'] as const,
  pages: () => [...CMS_QUERY_KEYS.all, 'pages'] as const,
  page: (name: string) => [...CMS_QUERY_KEYS.pages(), name] as const,
  sections: (pageName: string) => [...CMS_QUERY_KEYS.page(pageName), 'sections'] as const,
};

export function useCMSPageContent(pageName: string, locale?: string, enabled = true) {
  return useQuery({
    queryKey: [...CMS_QUERY_KEYS.page(pageName), locale ?? 'default'],
    queryFn: async () => {
      const response = await api.getCMSPageContent(pageName, locale);
      return response.data || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCMSPages() {
  return useQuery({
    queryKey: CMS_QUERY_KEYS.pages(),
    queryFn: async () => {
      const response = await api.getCMSPages();
      return unwrapApiList<unknown>(response as ApiResponse, []);
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function useUpdateCMSContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
      locale,
    }: {
      id: string;
      data: Partial<CMSContent>;
      locale?: string;
    }) => {
      const response = await api.updateCMSContent(id, data, locale);
      return response.data;
    },
    onMutate: async ({ id, data }) => {
      // Optimistically update any cached CMS page content containing this id
      const pageName = data.page_name;
      if (pageName) {
        await queryClient.cancelQueries({ queryKey: CMS_QUERY_KEYS.page(pageName) });
        const keys = [
          [...CMS_QUERY_KEYS.page(pageName), 'default'],
          ['cms', 'page', pageName],
        ];
        const snapshots: Record<string, unknown> = {};
        for (const key of keys) {
          const prev = queryClient.getQueryData(key);
          if (prev && Array.isArray(prev)) {
            snapshots[JSON.stringify(key)] = prev;
            queryClient.setQueryData(key, prev.map((item: any) =>
              item.id === id ? { ...item, ...data } : item
            ));
          }
        }
        return { snapshots };
      }
      return {};
    },
    onSuccess: (data: CMSContent | undefined) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: CMS_QUERY_KEYS.page(data.page_name),
        });
        queryClient.invalidateQueries({ queryKey: ['cms', 'page', data.page_name] });
        queryClient.invalidateQueries({ queryKey: ['cms', 'page', 'home'] });
      }
    },
    onError: (_err, _vars, context) => {
      // Rollback optimistic updates
      if (context?.snapshots) {
        for (const [key, value] of Object.entries(context.snapshots)) {
          queryClient.setQueryData(JSON.parse(key), value);
        }
      }
    },
  });
}

export function useCreateCMSContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<CMSContent, 'id' | 'created_at' | 'updated_at'>) => {
      const response = await api.createCMSContent(data);
      return response.data;
    },
    onSuccess: (data: CMSContent | undefined) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: CMS_QUERY_KEYS.page(data.page_name),
        });
        queryClient.invalidateQueries({ queryKey: ['cms', 'page', data.page_name] });
        queryClient.invalidateQueries({ queryKey: ['cms', 'page', 'home'] });
      }
    },
  });
}

export function useDeleteCMSContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.deleteCMSContent(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CMS_QUERY_KEYS.pages(),
      });
    },
  });
}
