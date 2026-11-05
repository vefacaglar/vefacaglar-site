export const CONTENT_TYPES = ["posts", "projects", "pages"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export type ContentStatus = "draft" | "published";

export interface ContentItem {
  id: string;
  slug: string;
  title: string;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
  author?: { username: string; displayName: string } | null;
  featured?: boolean;
  sortOrder?: number;
}

export interface ContentQuery {
  type: ContentType;
  query: string;
  status: ContentStatus | "";
  page: number;
  limit: number;
}

export interface ContentList {
  items: ContentItem[];
  total: number;
  totalPages: number;
}

export const CONTENT_LABELS: Record<ContentType, { label: string; singular: "post" | "project" | "page"; path: string }> = {
  posts: { label: "Posts", singular: "post", path: "/blog/" },
  projects: { label: "Projects", singular: "project", path: "/projects/" },
  pages: { label: "Pages", singular: "page", path: "/" },
};

type SearchParams = Record<string, string | string[] | undefined>;

export function parseContentQuery(params: SearchParams): ContentQuery {
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const type = CONTENT_TYPES.find((type) => type === value("content")) ?? "posts";
  const page = Number(value(`${type}Page`));
  const limit = Number(value(`${type}Limit`));
  const status = value(`${type}Status`);
  return {
    type,
    query: value(`${type}Query`).trim(),
    status: status === "draft" || status === "published" ? status : "",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    limit: [10, 50, 100].includes(limit) ? limit : 10,
  };
}

export function contentHref(
  currentParams: string,
  type: ContentType,
  updates: Partial<Pick<ContentQuery, "query" | "status" | "page" | "limit">> = {},
): string {
  const params = new URLSearchParams(currentParams);
  params.set("content", type);
  const names = { query: "Query", status: "Status", page: "Page", limit: "Limit" } as const;
  for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
    const value = updates[key];
    if (value === undefined) continue;
    if (value === "") params.delete(`${type}${names[key]}`);
    else params.set(`${type}${names[key]}`, String(value));
  }
  if (updates.query !== undefined || updates.status !== undefined || updates.limit !== undefined) {
    params.set(`${type}Page`, "1");
  }
  return `/dashboard?${params.toString()}`;
}

/** Search traverses API pages; normal browsing only requests the visible page. */
export async function loadContentList(
  state: ContentQuery,
  fetchPage: (page: number, limit: number) => Promise<ContentList>,
): Promise<ContentList & { page: number }> {
  if (state.query) {
    const matches = (items: ContentItem[]) => items.filter((item) =>
      `${item.title}\n${item.slug}`.toLowerCase().includes(state.query.toLowerCase()),
    );
    const first = await fetchPage(1, 1000);
    const items = matches(first.items);
    for (let page = 2; page <= first.totalPages; page++) {
      items.push(...matches((await fetchPage(page, 1000)).items));
    }
    const total = items.length;
    const totalPages = Math.ceil(total / state.limit);
    const page = Math.min(state.page, Math.max(1, totalPages));
    return { items: items.slice((page - 1) * state.limit, page * state.limit), total, totalPages, page };
  }

  const data = await fetchPage(state.page, state.limit);
  const page = Math.min(state.page, Math.max(1, data.totalPages));
  return { ...(page === state.page ? data : await fetchPage(page, state.limit)), page };
}
