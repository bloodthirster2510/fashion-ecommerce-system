export type PageInfo = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export const mergePageItems = <T extends { _id: string }>(current: T[], incoming: T[]) => {
  const itemsById = new Map(current.map((item) => [item._id, item]));
  incoming.forEach((item) => itemsById.set(item._id, item));
  return Array.from(itemsById.values());
};

export const hasNextPage = (pagination: PageInfo | null) =>
  Boolean(pagination && pagination.page < pagination.totalPages);
