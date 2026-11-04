import { afterEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidateTag }));

import { PUBLIC_CONTENT_TAG, revalidatePublicContent } from "./cacheTags";

afterEach(() => {
  vi.clearAllMocks();
});

describe("revalidatePublicContent", () => {
  it("invalidates the single public-content tag", () => {
    expect(PUBLIC_CONTENT_TAG).toBe("public-content");
    revalidatePublicContent();
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith("public-content");
  });
});
