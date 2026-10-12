/** Per-page head() for signed-in app screens: unique title + social text, never indexed. */
export function appHead(page: string, description: string) {
  const title = `${page} — ContactKickstart`;
  return () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  });
}
