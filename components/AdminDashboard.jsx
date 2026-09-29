"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { displayImageInputValue, normalizeDraft, parseSongRows } from "./adminDraft";
import AdminLogin from "./AdminLogin";
import { loadPublicContent } from "./adminContent";
import { loadOwnRequestStatus, deniedRequestExpiresAt, isVisibleOwnRequest } from "./adminRequestStatus";
import { adminReadFetch } from "./adminReadFetch";
import { resolveApiMediaUrl } from "./securityUrls";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";
const PAGE_SIZE = 50;
const KICKED_CONTENT_ADMIN_MESSAGE = "Your content admin access has been revoked.";
const ADMIN_SESSION_ROLE_KEY = "paralyze.adminSessionRole";
const ADMIN_SECTION_KEY = "paralyze.adminSection";

const CONTENT_ACTION = {
  Create: 1,
  Update: 2,
  Delete: 3
};

const STATUS_LABELS = {
  1: "Pending",
  2: "Approved",
  3: "Denied",
  4: "Cancelled",
  Pending: "Pending",
  Approved: "Approved",
  Denied: "Denied",
  Cancelled: "Cancelled"
};

const ACTION_LABELS = {
  1: "Create",
  2: "Update",
  3: "Delete",
  Create: "Create",
  Update: "Update",
  Delete: "Delete"
};

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const COLLECTIONS = [
  {
    key: "concerts",
    label: "Concerts",
    route: "/concerts",
    idKey: "concertId",
    fields: [
      { key: "date", label: "Date", required: true, type: "date" },
      { key: "location", label: "Location", required: true },
      { key: "time", label: "Time", type: "time" },
      { key: "numberOfSongs", label: "Number of songs", type: "number" }
    ],
    title: (record) => record.location,
    meta: (record) => [formatDate(record.date), record.time].filter(Boolean).join(" at "),
    detail: (record) => `${record.numberOfSongs || "0"} songs planned`
  },
  {
    key: "albums",
    label: "Albums",
    route: "/albums",
    idKey: "albumId",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "photoUrl", label: "Photo", type: "image" },
      { key: "releaseDate", label: "Release date", type: "date" },
      { key: "trackListJson", label: "Songs", type: "songRows", emptyValue: null },
      { key: "numberOfSongs", label: "Number of songs", type: "number" }
    ],
    title: (record) => record.title,
    meta: (record) => formatDate(record.releaseDate) || "Release date TBA",
    detail: (record) => {
      const songs = parseSongRows(record.trackListJson);
      return songs.length
        ? `${songs.length} songs: ${songs.map((song) => `${song.songName} (${song.duration})`).join(", ")}`
        : `${record.numberOfSongs || "0"} songs`;
    }
  },
  {
    key: "singles",
    label: "Singles",
    route: "/singles",
    idKey: "songId",
    fields: [
      { key: "songName", label: "Song name", required: true },
      { key: "photoUrl", label: "Photo", type: "image" },
      { key: "releaseDate", label: "Release date", type: "date" },
      { key: "description", label: "Text", type: "textarea", emptyValue: "" },
      { key: "availableOnYoutube", label: "YouTube URL", type: "url" },
      { key: "availableOnSpotify", label: "Spotify URL", type: "url" },
      { key: "albumId", label: "Album ID", type: "number", nullable: true }
    ],
    title: (record) => record.songName,
    meta: (record) => formatDate(record.releaseDate) || "Release date TBA",
    detail: (record) =>
      [record.availableOnYoutube && "YouTube", record.availableOnSpotify && "Spotify"]
        .filter(Boolean)
        .join(" / ") || "Streaming links pending"
  },
  {
    key: "news",
    label: "News",
    route: "/news",
    idKey: "newsId",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "publicationDate", label: "Publication date", required: true, type: "date" },
      { key: "author", label: "Author", required: true },
      { key: "content", label: "Content (optional)", type: "textarea", emptyValue: "" }
    ],
    title: (record) => record.title,
    meta: (record) => [formatDate(record.publicationDate), record.author].filter(Boolean).join(" / "),
    detail: (record) => record.content
  },
  {
    key: "timeline",
    label: "Timeline",
    route: "/timeline",
    idKey: "id",
    fields: [
      { key: "date", label: "Date", required: true, type: "date" },
      { key: "event", label: "Event", required: true },
      { key: "location", label: "Location", emptyValue: "" },
      { key: "description", label: "Description (optional)", emptyValue: "", type: "textarea" }
    ],
    title: (record) => record.event,
    meta: (record) => [formatDate(record.date), record.location].filter(Boolean).join(" / "),
    detail: (record) => record.description
  },
  {
    key: "members",
    label: "Members",
    route: "/members",
    idKey: "id",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "instrument", label: "Instrument", required: true },
      { key: "photoUrl", label: "Photo", type: "image" }
    ],
    title: (record) => record.name,
    meta: (record) => record.instrument,
    detail: (record) => record.photoUrl ? "Photo uploaded" : "No photo"
  },
  {
    key: "gallery",
    label: "Gallery",
    route: "/gallery",
    idKey: "id",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "imageUrl", label: "Media", type: "media" },
      { key: "description", label: "Description", type: "textarea", emptyValue: "" }
    ],
    title: (record) => record.title,
    meta: (record) => record.imageUrl ? "Media uploaded" : "No media",
    detail: (record) => record.description
  }
];

function emptyDraft(collection) {
  return Object.fromEntries(
    collection.fields.map((field) => [field.key, field.type === "songRows" ? [] : ""])
  );
}

function createInitialDrafts() {
  return Object.fromEntries(
    COLLECTIONS.map((collection) => [collection.key, emptyDraft(collection)])
  );
}

function normalizeStatus(status) {
  return STATUS_LABELS[status] ?? String(status);
}

function normalizeAction(action) {
  return ACTION_LABELS[action] ?? String(action);
}

function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function safeAdminMediaUrl(value) {
  return resolveApiMediaUrl(value, API_BASE);
}

function recordToDraft(collection, record) {
  return Object.fromEntries(
    collection.fields.map((field) => {
      const value = record[field.key];
      if (field.type === "date") {
        return [field.key, formatDate(value)];
      }

      if (field.type === "songRows") {
        return [field.key, parseSongRows(value)];
      }

      return [field.key, value ?? ""];
    })
  );
}

function safeParsePayload(payloadJson) {
  if (!payloadJson) return null;

  try {
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

function formatPreviewValue(value) {
  if (value === null || value === undefined || value === "") return "Empty";
  if (typeof value === "string" && value.startsWith("data:")) return "Uploaded media";
  const songRows = parseSongRows(value);
  if (songRows.length) {
    return songRows.map((song) => `${song.songName} (${song.duration})`).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function RequestFieldPreview({ field, value, version = "Submitted" }) {
  const imageUrl = field.type === "image" ? safeAdminMediaUrl(value) : null;
  const [failedUrl, setFailedUrl] = useState(null);
  if (!imageUrl) return formatPreviewValue(value);

  return (
    <span className="admin-request-photo">
      {failedUrl === imageUrl ? (
        <small>Photo preview could not be loaded.</small>
      ) : (
        /* Uploaded images are served by the API and may also be external URLs. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={imageUrl}
          alt={`${version} ${field.label.toLowerCase()}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(imageUrl)}
        />
      )}
      <a href={imageUrl} target="_blank" rel="noopener noreferrer">Open full-size photo</a>
    </span>
  );
}

function ReviewNoteInput({ value, onChange, disabled }) {
  return (
    <label className="admin-review-note">
      <span>Review note (optional)</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={1000}
        rows={3}
        disabled={disabled}
        placeholder="Explain your decision for this request"
      />
      <small>Saved when you click Approve or Deny. {value.length}/1000 characters.</small>
    </label>
  );
}

function getChangedFields(collection, current, payload) {
  if (!payload) return [];

  return collection.fields
    .map((field) => {
      const beforeValue = current?.[field.key] ?? "";
      const afterValue = payload[field.key] ?? "";
      const before = field.type === "date" ? formatDate(beforeValue) : beforeValue;
      const after = field.type === "date" ? formatDate(afterValue) : afterValue;

      return {
        key: field.key,
        label: field.label,
        type: field.type,
        before,
        after,
        changed: String(before ?? "") !== String(after ?? "")
      };
    })
    .filter((field) => field.changed);
}

function isUnsafeMethod(method = "GET") {
  return !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method.toUpperCase());
}

async function getCsrfToken() {
  const response = await fetch(`${API_BASE}/api/auth/csrf`, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new ApiError("Could not prepare a secure request.", response.status);
  }

  const result = await response.json();
  return result.token;
}

async function apiFetch(path, options = {}) {
  const method = options.method ?? "GET";
  const csrfToken = isUnsafeMethod(method) ? await getCsrfToken() : null;
  const response = await adminReadFetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken ? { "X-CSRF-TOKEN": csrfToken } : {}),
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    let code;
    const text = await response.text();

    try {
      const body = text ? JSON.parse(text) : null;
      code = body?.code;
      message = (Array.isArray(body)
        ? body.map((item) => item.description ?? item.code ?? JSON.stringify(item)).join(" ")
        : body?.title ?? body?.message ?? (body === null ? "" : JSON.stringify(body))) || message;
    } catch {
      if (text) message = text;
    }

    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function readStoredAdminRole() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(ADMIN_SESSION_ROLE_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeAdminRole(user) {
  if (typeof window === "undefined") return;

  try {
    const roles = user?.roles ?? [];
    if (roles.includes("SuperAdmin")) {
      window.localStorage.setItem(ADMIN_SESSION_ROLE_KEY, "SuperAdmin");
    } else if (roles.includes("ContentAdmin")) {
      window.localStorage.setItem(ADMIN_SESSION_ROLE_KEY, "ContentAdmin");
    } else {
      window.localStorage.removeItem(ADMIN_SESSION_ROLE_KEY);
    }
  } catch {
    // This optional notice hint must not prevent cookie-based sign-in.
  }
}

function clearStoredAdminRole() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ADMIN_SESSION_ROLE_KEY);
  } catch {
    // Sign-out must work even when browser storage is unavailable.
  }
}

export default function AdminDashboard() {
  const [session, setSession] = useState(null);
  const [activeKey, setActiveKey] = useState(COLLECTIONS[0].key);
  const [records, setRecords] = useState({});
  const [summary, setSummary] = useState(null);
  const [summaryStatus, setSummaryStatus] = useState("idle");
  const [adminPage, setAdminPage] = useState(1);
  const [hasMoreAdmins, setHasMoreAdmins] = useState(false);
  const [hasMoreAudit, setHasMoreAudit] = useState(false);
  const auditLoadVersion = useRef(0);
  const [drafts, setDrafts] = useState(createInitialDrafts);
  const [contentRequests, setContentRequests] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [adminProfiles, setAdminProfiles] = useState([]);
  const [hasMoreRecords, setHasMoreRecords] = useState({});
  const [hasMoreContentRequests, setHasMoreContentRequests] = useState(false);
  const [hasMoreAdminRequests, setHasMoreAdminRequests] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedAuditUserId, setSelectedAuditUserId] = useState("");
  const [caRequestsEnabled, setCaRequestsEnabled] = useState(false);
  const [kickConfirmation, setKickConfirmation] = useState(null);
  const [kickPassword, setKickPassword] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const [requestStatusError, setRequestStatusError] = useState("");
  const [requestExpiryTick, setRequestExpiryTick] = useState(0);
  const [uploadingField, setUploadingField] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [forcedLogoutNotice, setForcedLogoutNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [bootError, setBootError] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("Loading admin dashboard...");
  const [isMutating, setIsMutating] = useState(false);
  const mutationLock = useRef(false);
  const contentLoadVersion = useRef(0);
  const bootStarted = useRef(false);

  const isSuperAdmin = session?.roles?.includes("SuperAdmin");
  const isAdmin = session?.roles?.includes("SuperAdmin") || session?.roles?.includes("ContentAdmin");

  const activeCollection = useMemo(
    () => COLLECTIONS.find((collection) => collection.key === activeKey) ?? COLLECTIONS[0],
    [activeKey]
  );

  const activeRecords = records[activeCollection.key] ?? [];
  const activeDraft = drafts[activeCollection.key] ?? emptyDraft(activeCollection);
  const isEditing = editingRecord?.collectionKey === activeCollection.key;
  const visibleContentRequests = contentRequests.filter(
    (request) => isSuperAdmin && normalizeStatus(request.status) === "Pending"
  );

  useEffect(() => {
    if (bootStarted.current) return;
    bootStarted.current = true;
    try {
      const savedSection = window.sessionStorage.getItem(ADMIN_SECTION_KEY);
      if (COLLECTIONS.some((collection) => collection.key === savedSection)) {
        setActiveKey(savedSection);
      }
    } catch {
      // Storage may be disabled; section navigation should still work.
    }
    void boot();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      return undefined;
    }

    let isCancelled = false;

    async function verifyContentAdminAccess() {
      try {
        const user = await apiFetch("/api/auth/me");
        if (isCancelled) return;

        if (!user.roles?.some((role) => role === "ContentAdmin" || role === "SuperAdmin")) {
          handleAdminAccessError(new ApiError("Administrator access is no longer available.", 401));
        }
      } catch (err) {
        if (!isCancelled) {
          handleAdminAccessError(err);
        }
      }
    }

    const intervalId = window.setInterval(verifyContentAdminAccess, 10000);
    window.addEventListener("focus", verifyContentAdminAccess);
    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", verifyContentAdminAccess);
    };
  }, [session?.id, session?.roles, isAdmin]);

  useEffect(() => {
    if (!isAdmin || isSuperAdmin) return undefined;
    const controller = new AbortController();
    let inFlight = false;
    async function updateRequestStatus() {
      if (inFlight || mutationLock.current || document.hidden) return;
      inFlight = true;
      const version = contentLoadVersion.current;
      try {
        const read = (path) => apiFetch(path, {
          retry: false, cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)])
        });
        const [result, totals] = await Promise.all([
          loadOwnRequestStatus(read, contentRequests.length, PAGE_SIZE),
          read("/api/admin-dashboard/summary")
        ]);
        if (controller.signal.aborted || mutationLock.current || version !== contentLoadVersion.current) return;
        setContentRequests(result.requests);
        setHasMoreContentRequests(result.hasMore);
        setSummary(totals);
        setSummaryStatus("current");
        setRequestStatusError("");
      } catch (err) {
        if (!controller.signal.aborted && version === contentLoadVersion.current && !handleAdminAccessError(err)) {
          setRequestStatusError("Request decisions could not be updated. Showing the last loaded status.");
        }
      } finally {
        inFlight = false;
      }
    }
    const interval = window.setInterval(updateRequestStatus, 10000);
    window.addEventListener("focus", updateRequestStatus);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", updateRequestStatus);
    };
  }, [session?.id, isAdmin, isSuperAdmin, contentRequests.length]);

  useEffect(() => {
    if (!isAdmin || isSuperAdmin) return undefined;
    const now = Date.now();
    const expirations = contentRequests.map(deniedRequestExpiresAt)
      .filter((expiresAt) => expiresAt !== null && expiresAt > now);
    if (!expirations.length) return undefined;
    // Expire locally even if polling fails. Refetching never restarts the minute.
    const timer = window.setTimeout(() => setRequestExpiryTick((tick) => tick + 1),
      Math.min(Math.min(...expirations) - now, 60000));
    return () => window.clearTimeout(timer);
  }, [contentRequests, isAdmin, isSuperAdmin, requestExpiryTick]);

  function resetAdminState() {
    contentLoadVersion.current += 1;
    setSession(null);
    setActiveKey(COLLECTIONS[0].key);
    try {
      window.sessionStorage.removeItem(ADMIN_SECTION_KEY);
    } catch {
      // Storage is optional.
    }
    setRecords({});
    setSummary(null);
    setSummaryStatus("idle");
    setDrafts(createInitialDrafts());
    setEditingRecord(null);
    setContentRequests([]);
    setAdminProfiles([]);
    setAdminPage(1);
    setHasMoreAdmins(false);
    setHasMoreAudit(false);
    auditLoadVersion.current += 1;
    setHasMoreRecords({});
    setHasMoreContentRequests(false);
    setHasMoreAdminRequests(false);
    setAdminRequests([]);
    setAuditLogs([]);
    setSelectedAuditUserId("");
    setReviewNotes({});
    setRequestStatusError("");
    setUploadingField("");
    setKickConfirmation(null);
    setKickPassword("");
  }

  function handleContentAdminKickout() {
    resetAdminState();
    clearStoredAdminRole();
    setError("");
    setNotice("");
    setForcedLogoutNotice(KICKED_CONTENT_ADMIN_MESSAGE);
  }

  function handleAdminAccessError(err) {
    if (
      err instanceof ApiError &&
      err.code === "content_admin_access_revoked" &&
      (err.status === 401 || err.status === 403)
    ) {
      handleContentAdminKickout();
      return true;
    }

    if (err instanceof ApiError && err.status === 401) {
      resetAdminState();
      clearStoredAdminRole();
      setError("");
      setNotice("");
      setForcedLogoutNotice("Your session has expired. Please sign in again.");
      return true;
    }

    return false;
  }

  async function boot() {
    setIsLoading(true);
    setBootError("");
    setError("");
    setLoadingMessage("Loading admin dashboard...");
    const startupOptions = { retry: false };

    let user;
    try {
      user = await apiFetch("/api/auth/me", startupOptions);
      storeAdminRole(user);
      setSession(user);
    } catch (err) {
      setSession(null);
      if (
        err instanceof ApiError &&
        err.code === "content_admin_access_revoked" &&
        (err.status === 401 || err.status === 403)
      ) {
        clearStoredAdminRole();
        setForcedLogoutNotice(KICKED_CONTENT_ADMIN_MESSAGE);
      } else if (err instanceof ApiError && err.status === 401) {
        if (readStoredAdminRole()) {
          setForcedLogoutNotice("Your session has expired. Please sign in again.");
        }
        clearStoredAdminRole();
      }
      if (!(err instanceof ApiError && [401, 403].includes(err.status))) {
        setBootError("The administration API is unavailable or busy. Please try again shortly.");
      }
      setIsLoading(false);
      return;
    }

    try {
      await refreshDashboard(user, {
        onRetry: ({ waitMs }) => setLoadingMessage(
          `The administration API is busy. Retrying in ${Math.ceil(waitMs / 1000)} seconds...`
        )
      });
    } catch (err) {
      setError(err.message || "Some dashboard data could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshDashboard(user = session, readOptions = {}, scope = {}) {
    const read = (path, options = {}) => apiFetch(path, { ...options, ...readOptions });
    setSummaryStatus("refreshing");
    const version = contentLoadVersion.current + 1;
    const failures = await loadContentRows(readOptions, scope.collectionKeys);
    if (version !== contentLoadVersion.current) return;

    if (!user) return failures;

    try {
      const totals = await read("/api/admin-dashboard/summary", { cache: "no-store" });
      if (version !== contentLoadVersion.current) return;
      setSummary(totals);
      setSummaryStatus("current");
    } catch (err) {
      if (version !== contentLoadVersion.current) return;
      if (handleAdminAccessError(err)) return;
      setSummaryStatus("stale");
      failures.push("dashboard totals");
    }
    if (scope.refreshAdmin === false) {
      if (failures.length) throw new Error(`Could not refresh: ${failures.join(", ")}.`);
      return;
    }
    const roles = user.roles ?? [];
    if (roles.includes("SuperAdmin")) {
      const results = await Promise.allSettled([
        read(`/api/content-requests/pending?page=1&pageSize=${PAGE_SIZE}`),
        read(`/api/content-admins?page=1&pageSize=${PAGE_SIZE}`),
        read(`/api/content-admin-requests/pending?page=1&pageSize=${PAGE_SIZE}`),
        read("/api/ca-requests-permission")
      ]);
      if (version !== contentLoadVersion.current) return;
      if (results[0].status === "fulfilled") {
        setContentRequests(results[0].value);
        setHasMoreContentRequests(results[0].value.length === PAGE_SIZE);
      }
      else failures.push("content requests");
      if (results[1].status === "fulfilled") {
        setAdminProfiles(results[1].value);
        setAdminPage(1);
        setHasMoreAdmins(results[1].value.length === PAGE_SIZE);
      }
      else failures.push("content admins");
      if (results[2].status === "fulfilled") {
        setAdminRequests(results[2].value);
        setHasMoreAdminRequests(results[2].value.length === PAGE_SIZE);
      }
      else failures.push("admin signup requests");
      if (results[3].status === "fulfilled") setCaRequestsEnabled(Boolean(results[3].value.enabled));
      else failures.push("CA requests permission status");
    } else {
      try {
        const requests = await read(`/api/content-requests/mine?page=1&pageSize=${PAGE_SIZE}`);
        if (version !== contentLoadVersion.current) return;
        setContentRequests(requests);
        setHasMoreContentRequests(requests.length === PAGE_SIZE);
      } catch {
        failures.push("your content requests");
      }
      setAdminProfiles([]);
      setAdminRequests([]);
    }

    if (failures.length) {
      throw new Error(`Could not refresh: ${failures.join(", ")}.`);
    }
  }

  async function loadContentRows(readOptions = {}, collectionKeys) {
    const version = ++contentLoadVersion.current;
    const result = await loadPublicContent(
      collectionKeys ? COLLECTIONS.filter((collection) => collectionKeys.includes(collection.key)) : COLLECTIONS,
      (key) => apiFetch(`/api/content/${key}?afterId=0&pageSize=${PAGE_SIZE}`, { cache: "no-store", ...readOptions })
    );
    if (version !== contentLoadVersion.current) return [];
    if (result.records) {
      setRecords((current) => ({ ...current, ...result.records }));
      setHasMoreRecords((current) => ({
        ...current,
        ...Object.fromEntries(Object.entries(result.records).map(([key, rows]) => [key, rows.length === PAGE_SIZE]))
      }));
    }

    return result.failures;
  }

  async function loadMoreRecords() {
    if (!beginMutation()) return;
    setError("");
    const version = contentLoadVersion.current;
    const cursor = records[activeCollection.key]?.at(-1)?.[activeCollection.idKey] ?? 0;
    try {
      const nextRows = await apiFetch(
        `/api/content/${activeCollection.key}?afterId=${cursor}&pageSize=${PAGE_SIZE}`,
        { cache: "no-store" }
      );
      if (version !== contentLoadVersion.current) return;
      setRecords((current) => ({
        ...current,
        [activeCollection.key]: [...(current[activeCollection.key] ?? []), ...nextRows]
      }));
      setHasMoreRecords((current) => ({
        ...current,
        [activeCollection.key]: nextRows.length === PAGE_SIZE
      }));
    } catch (err) {
      if (version !== contentLoadVersion.current) return;
      if (!handleAdminAccessError(err)) {
        setError(err.message || `Could not load more ${activeCollection.label.toLowerCase()}.`);
      }
    } finally {
      endMutation();
    }
  }

  async function loadMoreContentRequests() {
    const cursor = contentRequests.at(-1);
    if (!cursor) return;
    if (!beginMutation()) return;
    setError("");
    const version = contentLoadVersion.current;
    const path = isSuperAdmin ? "pending" : "mine";
    try {
      const nextRequests = await apiFetch(
        `/api/content-requests/${path}?pageSize=${PAGE_SIZE}&afterRequestedAtUtc=${encodeURIComponent(cursor.requestedAtUtc)}&afterId=${cursor.id}`
      );
      if (version !== contentLoadVersion.current) return;
      setContentRequests((current) => [...current, ...nextRequests]);
      setHasMoreContentRequests(nextRequests.length === PAGE_SIZE);
    } catch (err) {
      if (version !== contentLoadVersion.current) return;
      if (!handleAdminAccessError(err)) {
        setError(err.message || "Could not load more content requests.");
      }
    } finally {
      endMutation();
    }
  }

  async function loadMoreAdminRequests() {
    const cursor = adminRequests.at(-1);
    if (!cursor) return;
    if (!beginMutation()) return;
    setError("");
    const version = contentLoadVersion.current;
    try {
      const nextRequests = await apiFetch(
        `/api/content-admin-requests/pending?pageSize=${PAGE_SIZE}&afterRequestedAtUtc=${encodeURIComponent(cursor.requestedAtUtc)}&afterId=${cursor.id}`
      );
      if (version !== contentLoadVersion.current) return;
      setAdminRequests((current) => [...current, ...nextRequests]);
      setHasMoreAdminRequests(nextRequests.length === PAGE_SIZE);
    } catch (err) {
      if (version !== contentLoadVersion.current) return;
      if (!handleAdminAccessError(err)) {
        setError(err.message || "Could not load more signup requests.");
      }
    } finally {
      endMutation();
    }
  }

  function beginMutation() {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setIsMutating(true);
    return true;
  }

  function endMutation() {
    mutationLock.current = false;
    setIsMutating(false);
  }

  async function login(identifier, password) {
    setForcedLogoutNotice("");
    const user = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: identifier, password })
    });

    if (!user.roles?.some((role) => role === "SuperAdmin" || role === "ContentAdmin")) {
      await apiFetch("/api/auth/logout", { method: "POST" });
      throw new Error("This account is not an approved admin yet.");
    }

    setSession(user);
    storeAdminRole(user);
    await refreshDashboard(user);
  }

  async function registerContentAdmin(payload) {
    await apiFetch("/api/auth/register-content-admin-request", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    resetAdminState();
    clearStoredAdminRole();
  }

  async function toggleCaRequestsPermission() {
    if (!isSuperAdmin || !beginMutation()) return;
    setError("");
    setNotice("");

    const nextEnabled = !caRequestsEnabled;
    try {
      const result = await apiFetch("/api/ca-requests-permission", {
        method: "PUT",
        body: JSON.stringify({ enabled: nextEnabled })
      });
      setCaRequestsEnabled(Boolean(result.enabled));
      setNotice(`CA registration requests are now ${result.enabled ? "allowed" : "forbidden"}.`);
    } catch (err) {
      if (!handleAdminAccessError(err)) setError(err.message);
    } finally {
      endMutation();
    }
  }

  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) {
        setError(err.message || "Could not sign out. Please try again.");
        return;
      }
    }
    resetAdminState();
    clearStoredAdminRole();
    setForcedLogoutNotice("");
  }

  function updateDraft(field, value) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [activeCollection.key]: {
        ...currentDrafts[activeCollection.key],
        [field]: value
      }
    }));
  }

  function addSongRow(field) {
    const currentRows = parseSongRows(activeDraft[field]);
    updateDraft(field, [...currentRows, { songName: "", duration: "", text: "" }]);
  }

  function updateSongRow(field, index, key, value) {
    const nextRows = parseSongRows(activeDraft[field]);
    nextRows[index] = {
      ...(nextRows[index] ?? { songName: "", duration: "" }),
      [key]: value
    };
    updateDraft(field, nextRows);
  }

  function removeSongRow(field, index) {
    updateDraft(
      field,
      parseSongRows(activeDraft[field]).filter((_, rowIndex) => rowIndex !== index)
    );
  }

  function beginEditRecord(record) {
    setError("");
    setNotice("");
    setEditingRecord({
      collectionKey: activeCollection.key,
      id: record[activeCollection.idKey],
      title: activeCollection.title(record)
    });
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [activeCollection.key]: recordToDraft(activeCollection, record)
    }));
  }

  function cancelEditRecord() {
    if (!editingRecord) return;

    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [editingRecord.collectionKey]: emptyDraft(
        COLLECTIONS.find((collection) => collection.key === editingRecord.collectionKey)
          ?? activeCollection
      )
    }));
    setEditingRecord(null);
  }

  async function uploadMedia(field, file) {
    if (!file) return;

    setError("");
    setUploadingField(field);

    try {
      const isVideo = file.type.startsWith("video/");
      const formData = new FormData();
      formData.append("file", file);
      const csrfToken = await getCsrfToken();

      const response = await fetch(`${API_BASE}/api/uploads/${isVideo ? "videos" : "images"}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRF-TOKEN": csrfToken
        },
        body: formData
      });

      if (!response.ok) {
        throw new ApiError(await response.text(), response.status);
      }

      const result = await response.json();
      const uploadedUrl = result.url ?? result.Url;
      const safeUrl = resolveApiMediaUrl(uploadedUrl, API_BASE);
      if (!safeUrl) {
        throw new Error(`Upload did not return a usable ${isVideo ? "video" : "image"} URL.`);
      }

      updateDraft(field, uploadedUrl);
    } catch (err) {
      if (!handleAdminAccessError(err)) {
        setError(err.message || "Media upload failed.");
      }
    } finally {
      setUploadingField("");
    }
  }

  async function saveContent(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const cleanedDraft = normalizeDraft(activeCollection, activeDraft);
    if (activeCollection.key === "albums") {
      const songs = parseSongRows(cleanedDraft.trackListJson);
      if (songs.length) {
        cleanedDraft.numberOfSongs = songs.length;
      }
    }
    const hasMissingRequired = activeCollection.fields.some(
      (field) => field.required && !cleanedDraft[field.key]
    );

    if (hasMissingRequired) return;
    if (!beginMutation()) return;

    try {
      if (isSuperAdmin && isEditing) {
        await apiFetch(`/api/content/${activeCollection.key}/${editingRecord.id}`, {
          method: "PUT",
          body: JSON.stringify(cleanedDraft)
        });
        setNotice(`${activeCollection.label} was updated on the site.`);
      } else if (isSuperAdmin) {
        await apiFetch(`/api/content/${activeCollection.key}`, {
          method: "POST",
          body: JSON.stringify(cleanedDraft)
        });
        setNotice(`${activeCollection.label} was published to the site.`);
      } else {
        await apiFetch("/api/content-requests", {
          method: "POST",
          body: JSON.stringify({
            contentType: activeCollection.key,
            targetEntityId: isEditing ? String(editingRecord.id) : null,
            action: isEditing ? CONTENT_ACTION.Update : CONTENT_ACTION.Create,
            payloadJson: JSON.stringify(cleanedDraft),
            message: `${isEditing ? "Update" : "Create"} ${activeCollection.label} content`
          })
        });
        setNotice(`${activeCollection.label} change request was sent for super admin approval.`);
      }

      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [activeCollection.key]: emptyDraft(activeCollection)
      }));
      setEditingRecord(null);
      await refreshDashboard(session, {}, isSuperAdmin
        ? { collectionKeys: [activeCollection.key], refreshAdmin: false }
        : { collectionKeys: [] });
    } catch (err) {
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    } finally {
      endMutation();
    }
  }

  async function approveRequest(requestId) {
    await submitReview("content", requestId, "approve");
  }

  async function denyRequest(requestId) {
    await submitReview("content", requestId, "deny");
  }

  async function submitReview(kind, requestId, decision) {
    if (!isSuperAdmin || !beginMutation()) return;
    const key = `${kind}:${requestId}`;
    const note = (reviewNotes[key] ?? "").trim();
    setError("");
    setNotice("");
    try {
      if (note.length > 1000) throw new Error("Review notes must be 1,000 characters or fewer.");
      const endpoint = kind === "content" ? "content-requests" : "content-admin-requests";
      const result = await apiFetch(`/api/${endpoint}/${requestId}/${decision}`, {
        method: "POST",
        body: JSON.stringify({ reviewNote: note || null })
      });
      setReviewNotes((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setNotice(`${result.changeCode ?? "Signup request"} ${decision === "approve" ? "approved" : "denied"}.${result.reviewNote ? ` Review note saved: ${result.reviewNote}` : ""}`);
      await refreshDashboard();
    } catch (err) {
      if (!handleAdminAccessError(err)) setError(err.message);
    } finally {
      endMutation();
    }
  }

  async function cancelRequest(requestId) {
    if (!beginMutation()) return;
    try {
      await apiFetch(`/api/content-requests/${requestId}/cancel`, { method: "POST" });
      await refreshDashboard();
    } catch (err) {
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    } finally {
      endMutation();
    }
  }

  async function removePublicRecord(record) {
    if (!isSuperAdmin) return;
    if (!beginMutation()) return;

    setError("");
    const collection = activeCollection;
    try {
      await apiFetch(`/api/content/${collection.key}/${record[collection.idKey]}`, {
        method: "DELETE"
      });
      setRecords((current) => ({
        ...current,
        [collection.key]: (current[collection.key] ?? []).filter(
          (row) => row[collection.idKey] !== record[collection.idKey]
        )
      }));
      await refreshDashboard(session, {}, { collectionKeys: [collection.key], refreshAdmin: false });
    } catch (err) {
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    } finally {
      endMutation();
    }
  }

  async function requestRecordRemoval(record) {
    if (!beginMutation()) return;
    setError("");
    setNotice("");

    try {
      await apiFetch("/api/content-requests", {
        method: "POST",
        body: JSON.stringify({
          contentType: activeCollection.key,
          targetEntityId: String(record[activeCollection.idKey]),
          action: CONTENT_ACTION.Delete,
          payloadJson: "{}",
          message: `Delete ${activeCollection.label} content`
        })
      });
      setNotice(`${activeCollection.label} deletion request was sent for super admin approval.`);
      await refreshDashboard();
    } catch (err) {
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    } finally {
      endMutation();
    }
  }

  async function approveAdminRequest(requestId) {
    await submitReview("signup", requestId, "approve");
  }

  async function denyAdminRequest(requestId) {
    await submitReview("signup", requestId, "deny");
  }

  function beginKickContentAdmin(profile) {
    setError("");
    setNotice("");
    setKickConfirmation(profile);
    setKickPassword("");
  }

  async function loadMoreAdmins() {
    if (!beginMutation()) return;
    const version = contentLoadVersion.current;
    setError("");
    try {
      const rows = await apiFetch(`/api/content-admins?page=${adminPage + 1}&pageSize=${PAGE_SIZE}`);
      if (version !== contentLoadVersion.current) return;
      setAdminProfiles((current) => [...new Map([...current, ...rows].map((row) => [row.userId, row])).values()]);
      setAdminPage((page) => page + 1);
      setHasMoreAdmins(rows.length === PAGE_SIZE);
    } catch (err) {
      if (!handleAdminAccessError(err)) setError(err.message);
    } finally {
      endMutation();
    }
  }

  async function loadAudit(userId, more = false) {
    const version = ++auditLoadVersion.current;
    setError("");
    setNotice("");
    const cursor = more ? auditLogs.at(-1) : null;
    if (!more) {
      setAuditLogs([]);
      setHasMoreAudit(false);
    }
    setSelectedAuditUserId(userId);
    try {
      const path = userId === "all" ? "/api/content-admins/audit" : `/api/content-admins/${encodeURIComponent(userId)}/audit`;
      const query = cursor
        ? `&afterCreatedAtUtc=${encodeURIComponent(cursor.createdAtUtc)}&afterId=${cursor.id}` : "";
      const rows = await apiFetch(`${path}?pageSize=${PAGE_SIZE}${query}`);
      if (version !== auditLoadVersion.current) return;
      setAuditLogs((current) => more
        ? [...new Map([...current, ...rows].map((row) => [row.id, row])).values()]
        : rows);
      setHasMoreAudit(rows.length === PAGE_SIZE);
    } catch (err) {
      if (version !== auditLoadVersion.current) return;
      if (!handleAdminAccessError(err)) setError(err.message);
    }
  }

  function cancelKickContentAdmin() {
    setKickConfirmation(null);
    setKickPassword("");
  }

  async function kickContentAdmin(event) {
    event.preventDefault();
    if (!kickConfirmation) return;
    if (!beginMutation()) return;

    setError("");
    setNotice("");

    try {
      await apiFetch(`/api/content-admins/${kickConfirmation.userId}`, {
        method: "DELETE",
        body: JSON.stringify({ password: kickPassword })
      });
      setNotice(`${kickConfirmation.displayName ?? kickConfirmation.userName} was kicked.`);
      cancelKickContentAdmin();
      await refreshDashboard();
    } catch (err) {
      // A bad confirmation password also returns 401; it does not end the
      // reviewer's session. Check the session before treating it as expiry.
      if (err instanceof ApiError && err.status === 401) {
        try {
          await apiFetch("/api/auth/me");
          setError(err.message);
        } catch (sessionError) {
          if (!handleAdminAccessError(sessionError)) setError(sessionError.message);
        }
        return;
      }
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    } finally {
      endMutation();
    }
  }

  if (isLoading) {
    return <p className="admin-empty-state" role="status">{loadingMessage}</p>;
  }

  if (bootError) {
    return (
      <section className="admin-empty-state">
        <p role="alert">{bootError}</p>
        <button type="button" onClick={() => void boot()}>Try again</button>
      </section>
    );
  }

  if (!session || !isAdmin) {
    return (
      <AdminLogin
        onLogin={login}
        onRegisterContentAdmin={registerContentAdmin}
        initialNotice={forcedLogoutNotice}
      />
    );
  }

  return (
    <>
      <section className="page-intro admin-intro">
        <span className="eyebrow">Admin</span>
        <h2 className="section-title">Content Approval Dashboard</h2>
        <p>Content admins submit database-backed changes. Super admins publish and manage admins.</p>
      </section>

      <div className="admin-toolbar">
        <div className="admin-role-info">
          <span>
            Signed in as <strong>{session.displayName ?? session.userName}</strong>
          </span>
          <span className={`admin-role-badge ${isSuperAdmin ? "admin-role-badge--super" : ""}`}>
            {isSuperAdmin ? "Super Admin" : "Content Admin"}
          </span>
        </div>
        <button type="button" className="admin-logout-btn" onClick={logout}>
          Sign Out
        </button>
      </div>

      <section className="admin-shell" aria-busy={isMutating}>
        {error && (
          <div className="admin-login-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void boot()} disabled={isMutating}>Reload dashboard data</button>
          </div>
        )}
        {notice && <p className="admin-empty-state">{notice}</p>}

        {summaryStatus === "refreshing" && <p role="status">Updating dashboard totals...</p>}
        {summaryStatus === "stale" && (
          <p role="status">{summary ? "Showing last successfully loaded totals. Totals could not be refreshed." : "Dashboard totals could not be loaded."}</p>
        )}
        <div className="admin-summary" aria-label="Dashboard summary" aria-busy={summaryStatus === "refreshing"}>
          <div className="admin-summary-item">
            <span>Public rows</span>
            <strong>{summary?.publicRows ?? "Unavailable"}</strong>
          </div>
          <div className="admin-summary-item">
            <span>Pending review</span>
            <strong className={summary?.pendingReview > 0 ? "admin-pending-count" : ""}>
              {summary?.pendingReview ?? "Unavailable"}
            </strong>
          </div>
          {isSuperAdmin && <div className="admin-summary-item">
            <span>Active content admins</span>
            <strong>{summary?.activeContentAdmins ?? "Unavailable"}</strong>
          </div>}
        </div>

        {isSuperAdmin && (
          <div className="admin-permission-control">
            <span>
              <strong>CA requests permission status</strong>
              <small>{caRequestsEnabled ? "Registration requests are allowed" : "Registration requests are forbidden"}</small>
            </span>
            <div className="switch">
              <input
                id="ca-requests-permission-toggle"
                type="checkbox"
                checked={caRequestsEnabled}
                onChange={toggleCaRequestsPermission}
                disabled={isMutating}
                aria-label="CA requests permission status"
              />
              <label
                className="toggle"
                htmlFor="ca-requests-permission-toggle"
                aria-hidden="true"
              >
                <i />
              </label>
            </div>
          </div>
        )}

        <div className="admin-workspace">
          <aside className="admin-sidebar" aria-label="Admin sections">
            {COLLECTIONS.map((collection) => (
              <button
                key={collection.key}
                type="button"
                className={collection.key === activeKey ? "active" : undefined}
                onClick={() => {
                  if (editingRecord) {
                    setDrafts((currentDrafts) => ({
                      ...currentDrafts,
                      [editingRecord.collectionKey]: emptyDraft(
                        COLLECTIONS.find((item) => item.key === editingRecord.collectionKey)
                          ?? activeCollection
                      )
                    }));
                  }
                  setEditingRecord(null);
                  setActiveKey(collection.key);
                  try {
                    window.sessionStorage.setItem(ADMIN_SECTION_KEY, collection.key);
                  } catch {
                    // Storage is optional.
                  }
                }}
              >
                <span>{collection.label}</span>
                <small>{records[collection.key]?.length ?? 0}</small>
              </button>
            ))}
          </aside>

          <div className="admin-editor">
            <div className="admin-editor-heading">
              <div>
                <h3>{activeCollection.label}</h3>
                <p>Database content type: {activeCollection.key}</p>
              </div>
              <a className="action-link" href={activeCollection.route}>
                <span>View Page</span>
              </a>
            </div>

            {isEditing && (
              <div className="admin-edit-banner">
                <span>Editing {editingRecord.title}</span>
                <button type="button" onClick={cancelEditRecord}>
                  Cancel Edit
                </button>
              </div>
            )}

            <form className="admin-form" onSubmit={saveContent}>
              <p className="admin-required-note">
                Fields marked <span>Required</span> must be filled in before saving.
              </p>
              {activeCollection.fields.map((field) => (
                <label
                  className={
                    field.type === "textarea" || field.type === "songRows"
                      ? "admin-form-wide"
                      : undefined
                  }
                  key={field.key}
                >
                  <span className="admin-field-label">
                    <span>{field.label}{(field.type === "image" || field.type === "media") && !field.required ? " (optional)" : ""}</span>
                    {field.required && <span className="admin-required-badge">Required</span>}
                  </span>
                  {field.type === "textarea" ? (
                    <textarea
                      value={activeDraft[field.key] ?? ""}
                      onChange={(event) => updateDraft(field.key, event.target.value)}
                      rows={4}
                      required={field.required}
                    />
                  ) : field.type === "image" || field.type === "media" ? (
                    <>
                      <input
                        type="text"
                        inputMode="url"
                        value={displayImageInputValue(activeDraft[field.key])}
                        onChange={(event) => updateDraft(field.key, event.target.value)}
                        placeholder={field.type === "media" ? "https://example.com/media.mp4" : "https://example.com/image.jpg"}
                        required={
                          field.required &&
                          !(field.type === "media"
                            ? safeAdminMediaUrl(activeDraft[field.key])
                            : safeAdminMediaUrl(activeDraft[field.key]))
                        }
                      />
                      <input
                        type="file"
                        accept={
                          field.type === "media"
                            ? "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                            : "image/png,image/jpeg,image/webp,image/gif"
                        }
                        onChange={(event) => uploadMedia(field.key, event.target.files?.[0])}
                      />
                      {uploadingField === field.key && <small>Uploading...</small>}
                      {(field.type === "media"
                        ? safeAdminMediaUrl(activeDraft[field.key])
                        : safeAdminMediaUrl(activeDraft[field.key])) ? (
                        <small>
                          Stored {field.type === "media" ? "media" : "image"}:{" "}
                          <a
                            href={
                              field.type === "media"
                                ? safeAdminMediaUrl(activeDraft[field.key])
                                : safeAdminMediaUrl(activeDraft[field.key])
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            Preview
                          </a>
                        </small>
                      ) : null}
                    </>
                  ) : field.type === "songRows" ? (
                    <div className="admin-song-rows">
                      {parseSongRows(activeDraft[field.key]).map((row, index) => (
                        <div className="admin-song-row" key={`${field.key}-${index}`}>
                          <input
                            type="text"
                            value={row.songName}
                            onChange={(event) =>
                              updateSongRow(field.key, index, "songName", event.target.value)
                            }
                            placeholder="Song name"
                          />
	                          <input
	                            type="text"
	                            inputMode="numeric"
	                            value={row.duration}
                            onChange={(event) =>
                              updateSongRow(field.key, index, "duration", event.target.value)
                            }
                            placeholder="3:45"
	                            pattern="\d{1,3}:[0-5]\d"
	                          />
	                          <textarea
	                            value={row.text}
	                            onChange={(event) =>
	                              updateSongRow(field.key, index, "text", event.target.value)
	                            }
	                            placeholder="Song text (optional)"
	                            rows={3}
	                          />
	                          <input
	                            type="url"
	                            value={row.availableOnYoutube ?? ""}
	                            onChange={(event) =>
	                              updateSongRow(
	                                field.key,
	                                index,
	                                "availableOnYoutube",
	                                event.target.value
	                              )
	                            }
	                            placeholder="YouTube URL (optional)"
	                          />
	                          <button type="button" onClick={() => removeSongRow(field.key, index)}>
	                            Delete row
	                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addSongRow(field.key)}>
                        Add a song row
                      </button>
                    </div>
                  ) : (
                    <input
                      type={field.type ?? "text"}
                      value={activeDraft[field.key] ?? ""}
                      onChange={(event) => updateDraft(field.key, event.target.value)}
                      required={field.required}
                    />
                  )}
                </label>
              ))}
              <div className="admin-actions">
                <button type="submit">
                  {isEditing
                    ? isSuperAdmin
                      ? "Update Row"
                      : "Submit Update Request"
                    : isSuperAdmin
                      ? "Publish Approved Row"
                      : "Submit Change Request"}
                </button>
                {isEditing && (
                  <button type="button" onClick={cancelEditRecord}>
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div className="admin-record-list" aria-live="polite">
              {!isSuperAdmin && contentRequests
                .filter((request) => String(request.contentType).toLowerCase() === activeCollection.key
                  && isVisibleOwnRequest(request))
                .map((request) => {
                  const status = normalizeStatus(request.status);
                  const payload = safeParsePayload(request.payloadJson);
                  return (
                    <article className="admin-record" key={`request-${request.id}`}>
                      <div>
                        <div className="admin-record-topline">
                          <h4>{payload && activeCollection.title(payload) || request.changeCode}</h4>
                          <span className={`status-${status.toLowerCase()}`}>
                            {status === "Pending" ? "Awaiting review" : "Denied"}
                          </span>
                        </div>
                        <p className="meta">{normalizeAction(request.action)} request · {request.changeCode}</p>
                        {status === "Denied" && (
                          <p className="admin-saved-review-note">
                            <strong>Super-admin review note:</strong> {request.reviewNote || "No review note was provided."}
                          </p>
                        )}
                        {status === "Pending" && <small>Awaiting a super-admin decision.</small>}
                      </div>
                    </article>
                  );
                })}
              {!isSuperAdmin && requestStatusError && <p role="status">{requestStatusError}</p>}
              {activeRecords.length ? (
                activeRecords.map((record) => (
                  <article className="admin-record" key={record[activeCollection.idKey]}>
                    <div>
                      <div className="admin-record-topline">
                        <h4>{activeCollection.title(record)}</h4>
                        <span className="status-approved">Approved</span>
                      </div>
                      <p className="meta">{activeCollection.meta(record)}</p>
                      <p>{activeCollection.detail(record)}</p>
                      {activeCollection.key === "members" && record.photoUrl && (
                        <RequestFieldPreview
                          field={{ type: "image", label: `photo of ${record.name}` }}
                          value={record.photoUrl}
                          version="Published"
                        />
                      )}
                      <small>Visible on public site</small>
                    </div>
                    <div className="admin-record-actions">
                      <button type="button" onClick={() => beginEditRecord(record)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => isSuperAdmin
                          ? removePublicRecord(record)
                          : requestRecordRemoval(record)}
                      >
                        {isSuperAdmin ? "Remove" : "Request Removal"}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="admin-empty-state">
                  {records[activeCollection.key] === undefined
                    ? "This collection could not be loaded. Refresh the page to try again."
                    : "No approved public rows yet."}
                </p>
              )}
            </div>
            {hasMoreRecords[activeCollection.key] && (
              <button type="button" onClick={loadMoreRecords} disabled={isMutating}>
                Load more {activeCollection.label.toLowerCase()}
              </button>
            )}
            {!isSuperAdmin && hasMoreContentRequests && (
              <button type="button" onClick={loadMoreContentRequests} disabled={isMutating}>
                Load older request decisions
              </button>
            )}
          </div>
        </div>

        {isSuperAdmin && (
        <div className="admin-review-panel">
          <div className="admin-editor-heading">
            <div>
              <h3>Content change requests</h3>
              <p>Pending content changes awaiting your review.</p>
            </div>
          </div>

          <div className="admin-record-list">
            {visibleContentRequests.length ? (
              visibleContentRequests.map((request) => {
                const collection = COLLECTIONS.find(
                  (item) => item.key === String(request.contentType).toLowerCase()
                );
                const payload = safeParsePayload(request.payloadJson);
                const status = normalizeStatus(request.status);
                const action = normalizeAction(request.action);
                const targetRecord = collection && request.targetEntityId
                  ? (records[collection.key] ?? []).find(
                      (record) => String(record[collection.idKey]) === String(request.targetEntityId)
                    )
                  : null;
                const changedFields = collection && action === "Update"
                  ? getChangedFields(collection, targetRecord, payload)
                  : [];

                return (
                  <article className="admin-record" key={request.id}>
                    <div>
                      <div className="admin-record-topline">
                        <h4>{request.changeCode}</h4>
                        <span className={`status-${status.toLowerCase()}`}>{status}</span>
                      </div>
                      <p className="meta">
                        {action} {request.contentType} by{" "}
                        {request.requestedByUserName ?? request.requestedByUserId}
                      </p>
                      <p>{payload && collection?.title(payload) ? collection.title(payload) : request.message}</p>
                      {action === "Update" && status === "Pending" && (
                        <div className="admin-change-preview">
                          {changedFields.length ? (
                            changedFields.map((field) => (
                              <div className="admin-change-row" key={field.key}>
                                <span>{field.label}</span>
                                <del><RequestFieldPreview field={field} value={field.before} version="Current" /></del>
                                <strong><RequestFieldPreview field={field} value={field.after} /></strong>
                              </div>
                            ))
                          ) : (
                            <small>No field differences detected.</small>
                          )}
                        </div>
                      )}
                      {action === "Create" && payload && collection && (
                        <div className="admin-change-preview">
                          {collection.fields.map((field) => (
                            <div className="admin-change-row" key={field.key}>
                              <span>{field.label}</span>
                              <strong><RequestFieldPreview field={field} value={payload[field.key]} /></strong>
                            </div>
                          ))}
                        </div>
                      )}
                      {action === "Delete" && status === "Pending" && targetRecord && (
                        <div className="admin-change-preview">
                          <small>Will remove {collection?.title(targetRecord)} from the public site.</small>
                        </div>
                      )}
                      {request.reviewNote ? <p className="admin-saved-review-note"><strong>Review note:</strong> {request.reviewNote}</p> : null}
                      {isSuperAdmin && status === "Pending" && (
                        <ReviewNoteInput
                          value={reviewNotes[`content:${request.id}`] ?? ""}
                          onChange={(value) => setReviewNotes((current) => ({ ...current, [`content:${request.id}`]: value }))}
                          disabled={isMutating}
                        />
                      )}
                    </div>
                    <div className="admin-record-actions">
                      {isSuperAdmin && status === "Pending" && (
                        <>
                          <button type="button" onClick={() => approveRequest(request.id)}>
                            Approve
                          </button>
                          <button type="button" onClick={() => denyRequest(request.id)}>
                            Deny
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="admin-empty-state">No pending content change requests.</p>
            )}
          </div>
          {hasMoreContentRequests && (
            <button type="button" onClick={loadMoreContentRequests} disabled={isMutating}>
              Load more content requests
            </button>
          )}
        </div>

        )}
        {isSuperAdmin && (
          <>
            <div className="admin-review-panel">
              <div className="admin-editor-heading">
                <div>
                  <h3>Content Admin Signup Requests</h3>
                  <p>Approve a candidate before they receive the ContentAdmin role.</p>
                </div>
              </div>
              <div className="admin-record-list">
                {adminRequests.length ? (
                  adminRequests.map((request) => (
                    <article className="admin-record" key={request.id}>
                      <div>
                        <div className="admin-record-topline">
                          <h4>{request.displayName ?? request.userName}</h4>
                          <span className="status-pending">Pending</span>
                        </div>
                        <p className="meta">{request.email}</p>
                        <p>{request.message}</p>
                        <ReviewNoteInput
                          value={reviewNotes[`signup:${request.id}`] ?? ""}
                          onChange={(value) => setReviewNotes((current) => ({ ...current, [`signup:${request.id}`]: value }))}
                          disabled={isMutating}
                        />
                      </div>
                      <div className="admin-record-actions">
                        <button type="button" onClick={() => approveAdminRequest(request.id)}>
                          Approve
                        </button>
                        <button type="button" onClick={() => denyAdminRequest(request.id)}>
                          Deny
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="admin-empty-state">No pending content admin signups.</p>
                )}
              </div>
              {hasMoreAdminRequests && (
                <button type="button" onClick={loadMoreAdminRequests} disabled={isMutating}>
                  Load more signup requests
                </button>
              )}
            </div>

            <div className="admin-review-panel">
              <div className="admin-editor-heading">
                <div>
                  <h3>Content Admins</h3>
                  <button type="button" onClick={() => loadAudit("all")}>All admin audit history</button>
                  <p>Kick removes Content Admin access and its admin profile. The account and its request history are retained.</p>
                </div>
              </div>
              <div className="admin-record-list">
                {adminProfiles.length ? (
                  adminProfiles.map((profile) => (
                    <article className="admin-record" key={profile.userId}>
                      <div>
                        <div className="admin-record-topline">
                          <h4>{profile.displayName ?? profile.userName}</h4>
                          <span>{profile.adminCode}</span>
                        </div>
                        <p className="meta">{profile.email}</p>
                      </div>
                      <div className="admin-record-actions">
                        <button type="button" onClick={() => loadAudit(profile.userId)}>
                          Audit
                        </button>
                        <button type="button" onClick={() => beginKickContentAdmin(profile)}>
                          Kick
                        </button>
                      </div>
                      {kickConfirmation?.userId === profile.userId && (
                        <form className="admin-kick-confirmation" onSubmit={kickContentAdmin}>
                          <label>
                            <span>Super admin password</span>
                            <input
                              type="password"
                              autoComplete="current-password"
                              value={kickPassword}
                              onChange={(event) => setKickPassword(event.target.value)}
                              required
                            />
                          </label>
                          <div className="admin-record-actions">
                            <button type="submit">Confirm Kick</button>
                            <button type="button" onClick={cancelKickContentAdmin}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="admin-empty-state">No content admins.</p>
                )}
              </div>
            </div>

            {hasMoreAdmins && (
              <button type="button" onClick={loadMoreAdmins} disabled={isMutating}>Load more content admins</button>
            )}

            {selectedAuditUserId && (
              <div className="admin-review-panel">
                <div className="admin-editor-heading">
                  <div>
                    <h3>Audit Log</h3>
                    {hasMoreAudit && <button type="button" onClick={() => loadAudit(selectedAuditUserId, true)}>Load older events</button>}
                    <p>{selectedAuditUserId === "all" ? "All administrators, including revoked accounts." : "Events for the selected administrator."}</p>
                  </div>
                </div>
                <div className="admin-record-list">
                  {auditLogs.length ? (
                    auditLogs.map((log) => (
                      <article className="admin-record" key={log.id}>
                        <div>
                          <div className="admin-record-topline">
                            <h4>{log.action}</h4>
                            <span>{formatDate(log.createdAtUtc)}</span>
                          </div>
                          <p className="meta">
                            {[log.entityType, log.entityId].filter(Boolean).join(" ") || "Admin account"}
                            {` | Admin: ${log.adminUserId} | Actor: ${log.performedByUserId ?? "Unknown"}`}
                          </p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="admin-empty-state">No audit events found.</p>
                  )}
                </div>
              </div>
            )}

          </>
        )}
      </section>
    </>
  );
}
