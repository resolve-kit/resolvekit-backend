import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "../api/client";
import { Badge, Button, Input, Textarea, useToast } from "../components/ui";

interface KnowledgeBaseItem {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface KnowledgeSource {
  id: string;
  source_type: "url" | "upload";
  input_url: string | null;
  title: string | null;
  status: string;
  last_crawled_at: string | null;
  last_error: string | null;
  created_at: string;
}

interface KnowledgeJob {
  id: string;
  status: string;
  job_type: string;
  error: string | null;
  stats: Record<string, unknown>;
  created_at: string;
  finished_at: string | null;
}

interface KnowledgeDocument {
  id: string;
  title: string | null;
  canonical_url: string | null;
  created_at: string;
  updated_at: string;
}

interface SearchHit {
  document_id: string;
  title: string | null;
  url: string | null;
  snippet: string;
  score: number;
}

export default function KnowledgeBases() {
  const [kbs, setKbs] = useState<KnowledgeBaseItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [newKbName, setNewKbName] = useState("");
  const [newKbDescription, setNewKbDescription] = useState("");
  const [isCreatingKb, setIsCreatingKb] = useState(false);

  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [jobs, setJobs] = useState<KnowledgeJob[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);

  const [newUrl, setNewUrl] = useState("");
  const [newUrlTitle, setNewUrlTitle] = useState("");
  const [isAddingUrl, setIsAddingUrl] = useState(false);

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { toast } = useToast();

  const selectedKb = useMemo(
    () => kbs.find((kb) => kb.id === selectedId) ?? null,
    [kbs, selectedId]
  );

  async function loadKnowledgeBases() {
    setIsLoading(true);
    try {
      const payload = await api<{ items: KnowledgeBaseItem[] }>("/v1/knowledge-bases");
      const items = payload.items ?? [];
      setKbs(items);
      setSelectedId((prev) => prev ?? items[0]?.id ?? null);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to load knowledge bases", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadKbDetails(kbId: string) {
    try {
      const [sourcesPayload, jobsPayload, docsPayload] = await Promise.all([
        api<{ items: KnowledgeSource[] }>(`/v1/knowledge-bases/${kbId}/sources`),
        api<{ items: KnowledgeJob[] }>(`/v1/knowledge-bases/${kbId}/jobs`),
        api<{ items: KnowledgeDocument[] }>(`/v1/knowledge-bases/${kbId}/documents?limit=100`),
      ]);
      setSources(sourcesPayload.items ?? []);
      setJobs(jobsPayload.items ?? []);
      setDocuments(docsPayload.items ?? []);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to load KB details", "error");
    }
  }

  useEffect(() => {
    void loadKnowledgeBases();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSources([]);
      setJobs([]);
      setDocuments([]);
      return;
    }
    void loadKbDetails(selectedId);
  }, [selectedId]);

  async function createKnowledgeBase() {
    if (!newKbName.trim()) return;
    setIsCreatingKb(true);
    try {
      await api("/v1/knowledge-bases", {
        method: "POST",
        body: JSON.stringify({
          name: newKbName.trim(),
          description: newKbDescription.trim() || null,
        }),
      });
      setNewKbName("");
      setNewKbDescription("");
      toast("Knowledge base created", "success");
      await loadKnowledgeBases();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to create knowledge base", "error");
    } finally {
      setIsCreatingKb(false);
    }
  }

  async function deleteKnowledgeBase(id: string) {
    try {
      await api(`/v1/knowledge-bases/${id}`, { method: "DELETE" });
      toast("Knowledge base deleted", "info");
      if (selectedId === id) {
        setSelectedId(null);
      }
      await loadKnowledgeBases();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to delete knowledge base", "error");
    }
  }

  async function addUrlSource() {
    if (!selectedId || !newUrl.trim()) return;
    setIsAddingUrl(true);
    try {
      await api(`/v1/knowledge-bases/${selectedId}/sources/url`, {
        method: "POST",
        body: JSON.stringify({
          url: newUrl.trim(),
          title: newUrlTitle.trim() || null,
        }),
      });
      setNewUrl("");
      setNewUrlTitle("");
      toast("Source added. Ingestion job queued.", "success");
      await loadKbDetails(selectedId);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to add source URL", "error");
    } finally {
      setIsAddingUrl(false);
    }
  }

  async function addUploadSource() {
    if (!selectedId || !uploadTitle.trim() || !uploadContent.trim()) return;
    setIsUploading(true);
    try {
      await api(`/v1/knowledge-bases/${selectedId}/sources/upload`, {
        method: "POST",
        body: JSON.stringify({
          title: uploadTitle.trim(),
          content: uploadContent,
        }),
      });
      setUploadTitle("");
      setUploadContent("");
      toast("Content uploaded. Ingestion job queued.", "success");
      await loadKbDetails(selectedId);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to upload knowledge content", "error");
    } finally {
      setIsUploading(false);
    }
  }

  async function recrawlSource(sourceId: string) {
    if (!selectedId) return;
    try {
      await api(`/v1/knowledge-bases/${selectedId}/sources/${sourceId}/recrawl`, {
        method: "POST",
      });
      toast("Recrawl job queued", "success");
      await loadKbDetails(selectedId);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to queue recrawl", "error");
    }
  }

  async function removeSource(sourceId: string) {
    if (!selectedId) return;
    try {
      await api(`/v1/knowledge-bases/${selectedId}/sources/${sourceId}`, {
        method: "DELETE",
      });
      toast("Source removed", "info");
      await loadKbDetails(selectedId);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to remove source", "error");
    }
  }

  async function runSearch() {
    if (!selectedId || !searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const payload = await api<{ items: SearchHit[] }>(`/v1/knowledge-bases/${selectedId}/search`, {
        method: "POST",
        body: JSON.stringify({
          query: searchQuery.trim(),
          limit: 10,
        }),
      });
      setSearchHits(payload.items ?? []);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to search knowledge base", "error");
    } finally {
      setIsSearching(false);
    }
  }

  async function removeDocument(documentId: string) {
    if (!selectedId) return;
    try {
      await api(`/v1/knowledge-bases/${selectedId}/documents/${documentId}`, {
        method: "DELETE",
      });
      toast("Document removed", "info");
      await loadKbDetails(selectedId);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to remove document", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-strong">Knowledge Bases</h1>
          <p className="text-sm text-subtle mt-1">
            Crawl docs, add support content, and assign reusable knowledge across apps.
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up">
        <h2 className="text-sm font-semibold text-strong mb-3">Create Knowledge Base</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            label="Name"
            placeholder="iOS Support Docs"
            value={newKbName}
            onChange={(e) => setNewKbName(e.target.value)}
          />
          <Input
            label="Description"
            placeholder="Troubleshooting and FAQ"
            value={newKbDescription}
            onChange={(e) => setNewKbDescription(e.target.value)}
          />
          <div className="flex items-end">
            <Button className="w-full" loading={isCreatingKb} onClick={createKnowledgeBase}>
              Create
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-strong mb-3">All Knowledge Bases</h2>
          {isLoading ? (
            <p className="text-xs text-subtle">Loading...</p>
          ) : kbs.length === 0 ? (
            <p className="text-xs text-subtle">No knowledge bases yet.</p>
          ) : (
            <div className="space-y-2">
              {kbs.map((kb) => (
                <div
                  key={kb.id}
                  className={`rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    selectedId === kb.id
                      ? "border-accent-dim bg-accent-subtle"
                      : "border-border bg-canvas/40 hover:border-border-2"
                  }`}
                  onClick={() => setSelectedId(kb.id)}
                >
                  <p className="text-sm text-strong">{kb.name}</p>
                  {kb.description && <p className="text-xs text-subtle mt-0.5">{kb.description}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <Link
                      to={`/knowledge-bases/${kb.id}`}
                      onClick={(e) => e.preventDefault()}
                      className="text-[11px] text-dim font-mono"
                    >
                      {kb.id.slice(0, 8)}...
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteKnowledgeBase(kb.id);
                      }}
                      className="text-xs text-danger hover:text-danger/80"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedKb ? (
            <>
              <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-strong">{selectedKb.name}</h2>
                    <p className="text-xs text-subtle mt-1">{selectedKb.description || "No description"}</p>
                  </div>
                  <Badge variant="active">{sources.length} sources</Badge>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up space-y-4">
                <h3 className="text-sm font-semibold text-strong">Add URL Source</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    label="Source URL"
                    placeholder="https://docs.example.com"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                  />
                  <Input
                    label="Title (optional)"
                    placeholder="Developer Docs"
                    value={newUrlTitle}
                    onChange={(e) => setNewUrlTitle(e.target.value)}
                  />
                  <div className="flex items-end">
                    <Button className="w-full" loading={isAddingUrl} onClick={addUrlSource}>
                      Add URL
                    </Button>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-strong">Add Text/Markdown Content</h3>
                <div className="space-y-3">
                  <Input
                    label="Content Title"
                    placeholder="FAQ v1"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                  <Textarea
                    label="Content"
                    placeholder="Paste markdown or support notes..."
                    rows={8}
                    value={uploadContent}
                    onChange={(e) => setUploadContent(e.target.value)}
                  />
                  <Button loading={isUploading} onClick={addUploadSource}>
                    Upload Content
                  </Button>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up">
                <h3 className="text-sm font-semibold text-strong mb-3">Sources</h3>
                {sources.length === 0 ? (
                  <p className="text-xs text-subtle">No sources yet.</p>
                ) : (
                  <div className="space-y-2">
                    {sources.map((source) => (
                      <div
                        key={source.id}
                        className="rounded-lg border border-border bg-canvas/40 px-3 py-2 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-strong truncate">
                            {source.title || source.input_url || "Uploaded content"}
                          </p>
                          <p className="text-xs text-subtle truncate">
                            {source.source_type === "url" ? source.input_url : "Manual upload"}
                          </p>
                          {source.last_error && <p className="text-xs text-danger mt-1">{source.last_error}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              source.status === "ready"
                                ? "active"
                                : source.status === "failed"
                                ? "revoked"
                                : "default"
                            }
                          >
                            {source.status}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => void recrawlSource(source.id)}>
                            Recrawl
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void removeSource(source.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up">
                <h3 className="text-sm font-semibold text-strong mb-3">Search</h3>
                <div className="flex gap-3">
                  <Input
                    placeholder="Search by keyword or natural question..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button loading={isSearching} onClick={runSearch}>
                    Search
                  </Button>
                </div>
                <div className="space-y-2 mt-4">
                  {searchHits.map((hit) => (
                    <div key={`${hit.document_id}-${hit.score}`} className="rounded-lg border border-border bg-canvas/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-strong truncate">{hit.title || "Untitled Document"}</p>
                        <span className="text-xs text-subtle">score {hit.score.toFixed(3)}</span>
                      </div>
                      {hit.url && <p className="text-xs text-dim truncate mt-1">{hit.url}</p>}
                      <p className="text-xs text-subtle mt-2 line-clamp-3">{hit.snippet}</p>
                    </div>
                  ))}
                  {searchHits.length === 0 && (
                    <p className="text-xs text-subtle mt-2">No search results yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up">
                <h3 className="text-sm font-semibold text-strong mb-3">Indexed Documents</h3>
                {documents.length === 0 ? (
                  <p className="text-xs text-subtle">No indexed documents yet.</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="rounded-lg border border-border bg-canvas/40 px-3 py-2 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-strong truncate">{doc.title || "Untitled"}</p>
                          {doc.canonical_url && (
                            <p className="text-xs text-subtle truncate">{doc.canonical_url}</p>
                          )}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => void removeDocument(doc.id)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-surface border border-border rounded-xl p-4 animate-fade-in-up">
                <h3 className="text-sm font-semibold text-strong mb-3">Ingestion Jobs</h3>
                {jobs.length === 0 ? (
                  <p className="text-xs text-subtle">No jobs yet.</p>
                ) : (
                  <div className="space-y-2">
                    {jobs.map((job) => (
                      <div key={job.id} className="rounded-lg border border-border bg-canvas/40 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-mono text-dim">{job.id.slice(0, 8)}...</p>
                          <Badge
                            variant={
                              job.status === "completed"
                                ? "active"
                                : job.status === "failed"
                                ? "revoked"
                                : "default"
                            }
                          >
                            {job.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-subtle mt-1">{job.job_type}</p>
                        {job.error && <p className="text-xs text-danger mt-1">{job.error}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-surface border border-border rounded-xl p-8 animate-fade-in-up">
              <p className="text-sm text-subtle">Select a knowledge base to manage sources and search content.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
