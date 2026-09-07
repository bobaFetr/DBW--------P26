"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CardGrid from "./CardGrid";
import { loadPublicContent } from "./publicContent";

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function newsCards(posts) {
  return posts.map((post) => ({
    title: post.title,
    meta: [dateOnly(post.publicationDate), post.author].filter(Boolean).join(" / "),
    body: post.content,
    href: `/news/?newsId=${post.newsId}`,
    linkLabel: "Read article"
  }));
}

export default function NewsBrowser({ emptyMessage = "No news posts have been published yet." }) {
  const searchParams = useSearchParams();
  const selectedNewsId = searchParams.get("newsId");
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadNews() {
      try {
        const rows = await loadPublicContent("news");
        if (!ignore) {
          setPosts(rows);
        }
      } catch {
        // Leave the page empty when the API is offline.
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadNews();
    return () => {
      ignore = true;
    };
  }, []);

  const selectedPost = useMemo(
    () => posts.find((post) => String(post.newsId) === String(selectedNewsId)),
    [posts, selectedNewsId]
  );

  if (isLoading) {
    return <p className="content-empty-state">Loading news...</p>;
  }

  if (!posts.length) {
    return <p className="content-empty-state">{emptyMessage}</p>;
  }

  if (selectedNewsId) {
    if (!selectedPost) {
      return (
        <section className="news-detail">
          <p className="content-empty-state">News article was not found.</p>
          <a className="action-link" href="/news/">
            <span>Back to news</span>
          </a>
        </section>
      );
    }

    return (
      <article className="news-detail">
        <a className="action-link news-back-link" href="/news/">
          <span>Back to news</span>
        </a>
        <p className="meta">
          {[dateOnly(selectedPost.publicationDate), selectedPost.author].filter(Boolean).join(" / ")}
        </p>
        <h2>{selectedPost.title}</h2>
        <div className="news-article-body">{selectedPost.content}</div>
      </article>
    );
  }

  return <CardGrid cards={newsCards(posts)} />;
}
