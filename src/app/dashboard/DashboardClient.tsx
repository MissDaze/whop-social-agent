"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
// Inline User type to avoid Prisma import issues in client component
interface User {
  id: string;
  name: string | null;
  email: string | null;
  openRouterKey: string | null;
  whopApiKey: string | null;
  redditAccountId: string | null;
  twitterConnectionToken: string | null;
  onboarded: boolean;
}

type Tab = "posts" | "hunt" | "comments" | "media" | "create" | "controls";

interface Post {
  id: string;
  platform: string;
  content: string;
  subreddit?: string | null;
  status: string;
  postedAt?: string | null;
  createdAt: string;
  product?: { name: string } | null;
}

interface Opportunity {
  id: string;
  platform: string;
  sourceUrl: string;
  authorName?: string | null;
  originalText: string;
  subreddit?: string | null;
  suggestedReply?: string | null;
  replyStatus: string;
  createdAt: string;
}

interface Comment {
  id: string;
  platform: string;
  authorName?: string | null;
  commentText: string;
  suggestedReply?: string | null;
  replyStatus: string;
  createdAt: string;
  post: { content: string; subreddit?: string | null };
}

interface Media {
  id: string;
  title: string;
  url: string;
  mediaType: string;
  platform?: string | null;
  isActive: boolean;
}

interface Log {
  id: string;
  runType: string;
  status: string;
  message?: string | null;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  whopUrl?: string | null;
}

export default function DashboardClient({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<Post[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const fetchPosts = useCallback(async () => {
    const r = await fetch("/api/posts?all=true");
    if (r.ok) setPosts(await r.json() as Post[]);
  }, []);

  const fetchOpps = useCallback(async () => {
    const r = await fetch("/api/opportunities");
    if (r.ok) setOpps(await r.json() as Opportunity[]);
  }, []);

  const fetchComments = useCallback(async () => {
    const r = await fetch("/api/comments");
    if (r.ok) setComments(await r.json() as Comment[]);
  }, []);

  const fetchMedia = useCallback(async () => {
    const r = await fetch("/api/media");
    if (r.ok) setMedia(await r.json() as Media[]);
  }, []);

  const fetchLogs = useCallback(async () => {
    const r = await fetch("/api/logs?limit=50");
    if (r.ok) setLogs(await r.json() as Log[]);
  }, []);

  const fetchProducts = useCallback(async () => {
    const r = await fetch("/api/products");
    if (r.ok) setProducts(await r.json() as Product[]);
  }, []);

  useEffect(() => {
    void fetchProducts();
    if (tab === "posts") void fetchPosts();
    else if (tab === "hunt") void fetchOpps();
    else if (tab === "comments") void fetchComments();
    else if (tab === "media") void fetchMedia();
    else if (tab === "controls") void fetchLogs();
  }, [tab, fetchPosts, fetchOpps, fetchComments, fetchMedia, fetchLogs, fetchProducts]);

  async function patchPost(id: string, action: string, content?: string) {
    const r = await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, content }),
    });
    if (r.ok) { void fetchPosts(); toast.success("Post updated"); }
    else toast.error("Failed to update post");
  }

  async function patchOpp(id: string, action: string, suggestedReply?: string) {
    const r = await fetch("/api/opportunities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, suggestedReply }),
    });
    if (r.ok) { void fetchOpps(); toast.success("Opportunity updated"); }
    else toast.error("Failed to update opportunity");
  }

  async function patchComment(id: string, action: string, suggestedReply?: string) {
    const r = await fetch("/api/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, suggestedReply }),
    });
    if (r.ok) { void fetchComments(); toast.success("Comment updated"); }
    else toast.error("Failed to update comment");
  }

  async function runAction(url: string, label: string) {
    setLoading(true);
    try {
      const r = await fetch(url, { method: "POST" });
      const data = await r.json() as Record<string, unknown>;
      if (r.ok) {
        toast.success(`${label} complete`);
        if (tab === "posts") void fetchPosts();
        else if (tab === "hunt") void fetchOpps();
        else if (tab === "comments") void fetchComments();
        void fetchLogs();
        return data;
      } else {
        toast.error(`${label} failed: ${String(data.error ?? "unknown error")}`);
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "posts", label: "Posts" },
    { id: "hunt", label: "Hunt" },
    { id: "comments", label: "Comments" },
    { id: "media", label: "Media" },
    { id: "create", label: "Create" },
    { id: "controls", label: "Controls" },
  ];

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-400",
      approved: "bg-blue-500/20 text-blue-400",
      posted: "bg-green-500/20 text-green-400",
      replied: "bg-green-500/20 text-green-400",
      rejected: "bg-red-500/20 text-red-400",
      failed: "bg-red-500/20 text-red-400",
    };
    return `inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[s] ?? "bg-gray-700 text-gray-300"}`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-sm font-bold">W</div>
          <span className="font-semibold text-white">Whop Social Agent</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{user.name ?? user.email ?? "Creator"}</span>
          <a href="/api/auth/logout" className="text-sm text-gray-500 hover:text-white transition-colors">Sign out</a>
        </div>
      </header>

      {/* Tabs */}
      <nav className="border-b border-gray-800 px-6 flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">

        {/* ── POSTS TAB ── */}
        {tab === "posts" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Scheduled Posts</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => runAction("/api/posts/publish", "Publish approved")}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  Publish Approved
                </button>
              </div>
            </div>
            {posts.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                No posts yet. Use the Create tab to generate posts.
              </div>
            )}
            {posts.map((post) => {
              let display = post.content;
              let subtitle = "";
              try {
                const p = JSON.parse(post.content) as Record<string, string>;
                display = p.title ?? post.content;
                subtitle = p.body ?? "";
              } catch { /* raw */ }
              return (
                <div key={post.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-400 uppercase">{post.platform}</span>
                        {post.subreddit && <span className="text-xs text-purple-400">r/{post.subreddit}</span>}
                        <span className={statusBadge(post.status)}>{post.status}</span>
                      </div>
                      {editId === post.id ? (
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white resize-none h-24"
                        />
                      ) : (
                        <>
                          <p className="text-white font-medium mt-1 leading-snug">{display.slice(0, 200)}</p>
                          {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle.slice(0, 150)}</p>}
                        </>
                      )}
                    </div>
                  </div>
                  {post.status === "pending" && (
                    <div className="flex gap-2 flex-wrap">
                      {editId === post.id ? (
                        <>
                          <button onClick={() => { void patchPost(post.id, "edit", editContent); setEditId(null); }} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg">Save</button>
                          <button onClick={() => setEditId(null)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-lg">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { void patchPost(post.id, "approve"); }} className="bg-green-600/20 hover:bg-green-600/40 text-green-400 text-xs px-3 py-1.5 rounded-lg border border-green-600/30">Approve</button>
                          <button onClick={() => { setEditId(post.id); setEditContent(post.content); }} className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs px-3 py-1.5 rounded-lg border border-blue-600/30">Edit</button>
                          <button onClick={() => { void patchPost(post.id, "reject"); }} className="bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-600/30">Reject</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── HUNT TAB ── */}
        {tab === "hunt" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Opportunity Hunter</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => runAction("/api/opportunities/hunt", "Hunt")}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  {loading ? "Hunting…" : "Hunt Now"}
                </button>
                <button
                  onClick={() => runAction("/api/opportunities/publish", "Publish replies")}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  Publish Replies
                </button>
              </div>
            </div>
            {opps.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                No opportunities yet. Click &quot;Hunt Now&quot; to search Reddit.
              </div>
            )}
            {opps.map((opp) => (
              <div key={opp.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {opp.subreddit && <span className="text-xs text-purple-400">r/{opp.subreddit}</span>}
                      {opp.authorName && <span className="text-xs text-gray-500">by u/{opp.authorName}</span>}
                      <span className={statusBadge(opp.replyStatus)}>{opp.replyStatus}</span>
                    </div>
                    <p className="text-white text-sm mt-1 leading-relaxed">{opp.originalText.slice(0, 250)}</p>
                    <a href={opp.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-1 block">View on Reddit →</a>
                    {opp.suggestedReply && (
                      <div className="mt-2 bg-gray-800/60 border border-gray-700 rounded-lg p-2">
                        <p className="text-xs text-gray-400 mb-1">AI Reply:</p>
                        {editId === opp.id ? (
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white resize-none h-20"
                          />
                        ) : (
                          <p className="text-sm text-gray-300">{opp.suggestedReply}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {opp.replyStatus === "pending" && (
                  <div className="flex gap-2 flex-wrap">
                    {editId === opp.id ? (
                      <>
                        <button onClick={() => { void patchOpp(opp.id, "edit", editContent); setEditId(null); }} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg">Save</button>
                        <button onClick={() => setEditId(null)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-lg">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { void patchOpp(opp.id, "approve"); }} className="bg-green-600/20 hover:bg-green-600/40 text-green-400 text-xs px-3 py-1.5 rounded-lg border border-green-600/30">Approve Reply</button>
                        <button onClick={() => { setEditId(opp.id); setEditContent(opp.suggestedReply ?? ""); }} className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs px-3 py-1.5 rounded-lg border border-blue-600/30">Edit Reply</button>
                        <button onClick={() => { void patchOpp(opp.id, "reject"); }} className="bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-600/30">Skip</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── COMMENTS TAB ── */}
        {tab === "comments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Comment Monitor</h2>
              <div className="flex gap-2">
                <button onClick={() => runAction("/api/comments/monitor", "Monitor")} disabled={loading} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                  {loading ? "Checking…" : "Check Now"}
                </button>
                <button onClick={() => runAction("/api/comments/publish", "Publish replies")} disabled={loading} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                  Publish Replies
                </button>
              </div>
            </div>
            {comments.length === 0 && (
              <div className="text-center py-16 text-gray-500">No comments yet. Post to Reddit first, then monitor for replies.</div>
            )}
            {comments.map((c) => (
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {c.authorName && <span className="text-xs text-gray-500">u/{c.authorName}</span>}
                  <span className="text-xs text-gray-400">on your post</span>
                  <span className={statusBadge(c.replyStatus)}>{c.replyStatus}</span>
                </div>
                <p className="text-white text-sm">{c.commentText.slice(0, 300)}</p>
                {c.suggestedReply && (
                  <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-2">
                    <p className="text-xs text-gray-400 mb-1">Suggested Reply:</p>
                    {editId === c.id ? (
                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white resize-none h-20" />
                    ) : (
                      <p className="text-sm text-gray-300">{c.suggestedReply}</p>
                    )}
                  </div>
                )}
                {c.replyStatus === "pending" && (
                  <div className="flex gap-2 flex-wrap">
                    {editId === c.id ? (
                      <>
                        <button onClick={() => { void patchComment(c.id, "edit", editContent); setEditId(null); }} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg">Save</button>
                        <button onClick={() => setEditId(null)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-lg">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { void patchComment(c.id, "approve"); }} className="bg-green-600/20 hover:bg-green-600/40 text-green-400 text-xs px-3 py-1.5 rounded-lg border border-green-600/30">Approve</button>
                        <button onClick={() => { setEditId(c.id); setEditContent(c.suggestedReply ?? ""); }} className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs px-3 py-1.5 rounded-lg border border-blue-600/30">Edit</button>
                        <button onClick={() => { void patchComment(c.id, "reject"); }} className="bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-600/30">Skip</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── MEDIA TAB ── */}
        {tab === "media" && (
          <MediaTab media={media} onRefresh={fetchMedia} />
        )}

        {/* ── CREATE TAB ── */}
        {tab === "create" && (
          <CreateTab products={products} onGenerated={() => { setTab("posts"); void fetchPosts(); }} />
        )}

        {/* ── CONTROLS TAB ── */}
        {tab === "controls" && (
          <ControlsTab user={user} logs={logs} loading={loading} onRunAction={runAction} />
        )}
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MediaTab({ media, onRefresh }: { media: Media[]; onRefresh: () => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("video");
  const [saving, setSaving] = useState(false);

  async function addMedia() {
    if (!title || !url) return toast.error("Title and URL required");
    setSaving(true);
    const r = await fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, url, mediaType: type }),
    });
    setSaving(false);
    if (r.ok) { toast.success("Media added"); setTitle(""); setUrl(""); onRefresh(); }
    else toast.error("Failed to add media");
  }

  async function deleteMedia(id: string) {
    const r = await fetch("/api/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (r.ok) { toast.success("Deleted"); onRefresh(); }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Media Library</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <p className="text-sm text-gray-400">Add sample videos or images to reference in your posts.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (YouTube, TikTok, etc.)" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
        </div>
        <div className="flex items-center gap-3">
          <select value={type} onChange={(e) => setType(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
            <option value="video">Video</option>
            <option value="image">Image</option>
            <option value="audio">Audio</option>
          </select>
          <button onClick={addMedia} disabled={saving} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            {saving ? "Adding…" : "Add Media"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {media.map((m) => (
          <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{m.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{m.url}</p>
              <p className="text-xs text-gray-600 mt-0.5">{m.mediaType}</p>
            </div>
            <button onClick={() => deleteMedia(m.id)} className="text-red-400 hover:text-red-300 text-xs shrink-0">Delete</button>
          </div>
        ))}
      </div>
      {media.length === 0 && <div className="text-center py-8 text-gray-500">No media yet.</div>}
    </div>
  );
}

function CreateTab({ products, onGenerated }: { products: Product[]; onGenerated: () => void }) {
  const [platform, setPlatform] = useState<"reddit" | "twitter" | "tiktok">("reddit");
  const [productId, setProductId] = useState("");
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, productId: productId || undefined, count }),
      });
      const data = await r.json() as { posts?: unknown[]; error?: string };
      if (r.ok) {
        toast.success(`Generated ${(data.posts ?? []).length} posts`);
        onGenerated();
      } else {
        toast.error(data.error ?? "Generation failed");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h2 className="text-xl font-semibold">Generate Posts</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Platform</label>
          <div className="flex gap-2">
            {(["reddit", "twitter", "tiktok"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  platform === p ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Product (optional)</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
            <option value="">— No specific product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Number of posts</label>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 3)}
            className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          />
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {generating ? "Generating…" : "Generate Posts"}
        </button>
      </div>
    </div>
  );
}

function ControlsTab({
  user,
  logs,
  loading,
  onRunAction,
}: {
  user: User;
  logs: Log[];
  loading: boolean;
  onRunAction: (url: string, label: string) => Promise<Record<string, unknown> | undefined>;
}) {
  const [settings, setSettings] = useState({
    openRouterKey: user.openRouterKey ?? "",
    whopApiKey: user.whopApiKey ?? "",
    redditAccountId: user.redditAccountId ?? "",
    twitterConnectionToken: user.twitterConnectionToken ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function saveSettings() {
    setSaving(true);
    const r = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (r.ok) toast.success("Settings saved");
    else toast.error("Failed to save settings");
  }

  const formatDate = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-4">Agent Controls</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { url: "/api/opportunities/hunt", label: "Hunt Reddit" },
            { url: "/api/generate", label: "Generate Posts" },
            { url: "/api/comments/monitor", label: "Monitor Comments" },
            { url: "/api/posts/publish", label: "Publish Posts" },
            { url: "/api/opportunities/publish", label: "Publish Opp. Replies" },
            { url: "/api/comments/publish", label: "Publish Comment Replies" },
          ].map((a) => (
            <button
              key={a.url}
              onClick={() => onRunAction(a.url, a.label)}
              disabled={loading}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg border border-gray-700 transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">API Settings</h2>
        <div className="space-y-3 max-w-lg">
          {[
            { key: "openRouterKey", label: "OpenRouter API Key", placeholder: "sk-or-v1-..." },
            { key: "whopApiKey", label: "Whop API Key", placeholder: "api_..." },
            { key: "redditAccountId", label: "Reddit Composio Account ID", placeholder: "ca_..." },
            { key: "twitterConnectionToken", label: "X / Twitter Connection Token", placeholder: "Bearer token..." },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-sm text-gray-400 mb-1">{f.label}</label>
              <input
                type="password"
                value={settings[f.key as keyof typeof settings]}
                onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
            </div>
          ))}
          <button onClick={saveSettings} disabled={saving} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm px-5 py-2.5 rounded-lg transition-colors">
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Agent Logs</h2>
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${log.status === "success" ? "bg-green-400" : "bg-red-400"}`} />
                <span className="text-sm text-white">{log.message ?? log.runType}</span>
                <span className="text-xs text-gray-500">{log.runType}</span>
              </div>
              <span className="text-xs text-gray-600 shrink-0">{formatDate(log.createdAt)}</span>
            </div>
          ))}
          {logs.length === 0 && <div className="text-gray-500 text-sm text-center py-8">No logs yet.</div>}
        </div>
      </div>
    </div>
  );
}
