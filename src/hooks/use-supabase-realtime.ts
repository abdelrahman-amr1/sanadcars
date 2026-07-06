import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useRealtimeTable<T extends { id: string }>(
  tableName: string,
  initialData: T[],
  selectQuery: string = '*'
) {
  const [data, setData] = useState<T[]>(initialData);
  const [prevInitialData, setPrevInitialData] = useState<T[]>(initialData);

  // Sync prop changes to state during render (React recommended pattern)
  if (initialData !== prevInitialData) {
    setData(initialData);
    setPrevInitialData(initialData);
  }

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
        async (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const newRow = payload.new as T;
          const oldRow = payload.old as { id: string };

          if (payload.eventType === 'INSERT') {
            const { data: newData, error } = await supabase
              .from(tableName)
              .select(selectQuery)
              .eq('id', newRow.id)
              .single();

            if (!error && newData) {
              setData((prev) => [newData as unknown as T, ...prev]);
            } else if (newRow) {
              setData((prev) => [newRow, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const { data: updatedData, error } = await supabase
              .from(tableName)
              .select(selectQuery)
              .eq('id', newRow.id)
              .single();

            if (!error && updatedData) {
              setData((prev) =>
                prev.map((item) => (item.id === newRow.id ? (updatedData as unknown as T) : item))
              );
            } else if (newRow) {
              setData((prev) =>
                prev.map((item) => (item.id === newRow.id ? newRow : item))
              );
            }
          } else if (payload.eventType === 'DELETE') {
            setData((prev) => prev.filter((item) => item.id !== oldRow.id));
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


