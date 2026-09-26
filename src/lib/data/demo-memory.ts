const buckets = new Map<string, Map<string, unknown[]>>();

export function readDemo<T>(collection: string, userId: string): T[] {
  return (buckets.get(collection)?.get(userId) as T[] | undefined) ?? [];
}

export function saveDemo<T extends { id: string }>(collection: string, userId: string, row: T) {
  const users = buckets.get(collection) ?? new Map<string, unknown[]>();
  const rows = (users.get(userId) as T[] | undefined) ?? [];
  users.set(userId, [row, ...rows.filter((item) => item.id !== row.id)]);
  buckets.set(collection, users);
}

export function removeDemo(collection: string, userId: string, id: string) {
  const users = buckets.get(collection);
  const rows = users?.get(userId);
  if (!users || !rows) return;
  users.set(userId, rows.filter((item) => (item as { id: string }).id !== id));
}
