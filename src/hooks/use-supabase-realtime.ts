import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useRealtimeTable<T extends { id: string }>(
  tableName: string,
  initialData: T[],
  selectQuery: string = '*'
) {
  const [data, setData] = useState<T[]>(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${tableName}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: tableName,
        },
        async (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const { data: newData, error } = await supabase
              .from(tableName)
              .select(selectQuery)
              .eq('id', payload.new.id)
              .single();

            if (!error && newData) {
              setData((prev) => [newData as unknown as T, ...prev]);
            } else if (payload.new) {
              setData((prev) => [payload.new as unknown as T, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const { data: updatedData, error } = await supabase
              .from(tableName)
              .select(selectQuery)
              .eq('id', payload.new.id)
              .single();

            if (!error && updatedData) {
              setData((prev) =>
                prev.map((item) => (item.id === payload.new.id ? (updatedData as unknown as T) : item))
              );
            } else if (payload.new) {
              setData((prev) =>
                prev.map((item) => (item.id === payload.new.id ? (payload.new as unknown as T) : item))
              );
            }
          } else if (payload.eventType === 'DELETE') {
            setData((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, selectQuery]);

  return [data, setData] as const;
}

