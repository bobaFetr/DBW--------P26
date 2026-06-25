"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { displayImageInputValue, normalizeDraft, parseSongRows } from "./adminDraft";
import AdminLogin from "./AdminLogin";
import { safeImageUrl, safeMediaUrl } from "./securityUrls";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";
const KICKED_CONTENT_ADMIN_MESSAGE = "You can no longer prime Milf.";
const ADMIN_SESSION_ROLE_KEY = "paralyze.adminSessionRole";

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
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
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
      { key: "content", label: "Content", required: true, type: "textarea" }
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
      { key: "description", label: "Description", required: true, type: "textarea" }
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
      { key: "photoUrl", label: "Photo", required: true, type: "image" }
    ],
    title: (record) => record.name,
    meta: (record) => record.instrument,
    detail: () => "Photo uploaded"
  },
  {
    key: "gallery",
    label: "Gallery",
    route: "/gallery",
    idKey: "id",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "imageUrl", label: "Media", required: true, type: "media" },
      { key: "description", label: "Description", type: "textarea", emptyValue: "" }
    ],
    title: (record) => record.title,
    meta: () => "Media uploaded",
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
    throw new Error("Could not prepare a secure request.");
  }

  const result = await response.json();
  return result.token;
}

async function apiFetch(path, options = {}) {
  const method = options.method ?? "GET";
  const csrfToken = isUnsafeMethod(method) ? await getCsrfToken() : null;
  const response = await fetch(`${API_BASE}${path}`, {
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
    const text = await response.text();

    try {
      const body = text ? JSON.parse(text) : null;
      message = Array.isArray(body)
        ? body.map((item) => item.description ?? item.code ?? JSON.stringify(item)).join(" ")
        : body?.title ?? body?.message ?? JSON.stringify(body);
    } catch {
      if (text) message = text;
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function readStoredAdminRole() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ADMIN_SESSION_ROLE_KEY) ?? "";
}

function storeAdminRole(user) {
  if (typeof window === "undefined") return;

  const roles = user?.roles ?? [];
  if (roles.includes("SuperAdmin")) {
    window.localStorage.setItem(ADMIN_SESSION_ROLE_KEY, "SuperAdmin");
  } else if (roles.includes("ContentAdmin")) {
    window.localStorage.setItem(ADMIN_SESSION_ROLE_KEY, "ContentAdmin");
  } else {
    window.localStorage.removeItem(ADMIN_SESSION_ROLE_KEY);
  }
}

function clearStoredAdminRole() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_SESSION_ROLE_KEY);
}

export default function AdminDashboard() {
  const [session, setSession] = useState(null);
  const [activeKey, setActiveKey] = useState(COLLECTIONS[0].key);
  const [records, setRecords] = useState({});
  const [drafts, setDrafts] = useState(createInitialDrafts);
  const [contentRequests, setContentRequests] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [adminProfiles, setAdminProfiles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedAuditUserId, setSelectedAuditUserId] = useState("");
  const [kickConfirmation, setKickConfirmation] = useState(null);
  const [kickPassword, setKickPassword] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [uploadingField, setUploadingField] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [forcedLogoutNotice, setForcedLogoutNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const isSuperAdmin = session?.roles?.includes("SuperAdmin");
  const isAdmin = session?.roles?.includes("SuperAdmin") || session?.roles?.includes("ContentAdmin");

  const activeCollection = useMemo(
    () => COLLECTIONS.find((collection) => collection.key === activeKey) ?? COLLECTIONS[0],
    [activeKey]
  );

  const activeRecords = records[activeCollection.key] ?? [];
  const activeDraft = drafts[activeCollection.key] ?? emptyDraft(activeCollection);
  const isEditing = editingRecord?.collectionKey === activeCollection.key;
  const visibleRequests = contentRequests;
  const pendingRequests = contentRequests.filter(
    (request) => normalizeStatus(request.status) === "Pending"
  );
  const publicCount = COLLECTIONS.reduce(
    (total, collection) => total + (records[collection.key]?.length ?? 0),
    0
  );

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (!session?.roles?.includes("ContentAdmin") || session.roles.includes("SuperAdmin")) {
      return undefined;
    }

    let isCancelled = false;

    async function verifyContentAdminAccess() {
      try {
        const user = await apiFetch("/api/auth/me");
        if (isCancelled) return;

        if (!user.roles?.includes("ContentAdmin") || user.roles?.includes("SuperAdmin")) {
          handleContentAdminKickout();
        }
      } catch (err) {
        if (!isCancelled) {
          handleAdminAccessError(err);
        }
      }
    }

    const intervalId = window.setInterval(verifyContentAdminAccess, 10000);
    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [session?.userId, session?.roles]);

  function resetAdminState() {
    setSession(null);
    setContentRequests([]);
    setAdminProfiles([]);
    setAdminRequests([]);
    setAuditLogs([]);
    setSelectedAuditUserId("");
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
      session?.roles?.includes("ContentAdmin") &&
      !session?.roles?.includes("SuperAdmin") &&
      err instanceof ApiError &&
      (err.status === 401 || err.status === 403)
    ) {
      handleContentAdminKickout();
      return true;
    }

    return false;
  }

  async function boot() {
    setIsLoading(true);
    setError("");

    try {
      const user = await apiFetch("/api/auth/me");
      storeAdminRole(user);
      setSession(user);
      await refreshDashboard(user);
    } catch (err) {
      setSession(null);
      if (
        readStoredAdminRole() === "ContentAdmin" &&
        err instanceof ApiError &&
        (err.status === 401 || err.status === 403)
      ) {
        clearStoredAdminRole();
        setForcedLogoutNotice(KICKED_CONTENT_ADMIN_MESSAGE);
      }
      await loadContentRows();
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshDashboard(user = session) {
    await loadContentRows();

    if (!user) return;

    const roles = user.roles ?? [];
    if (roles.includes("SuperAdmin")) {
      const [requests, admins, pendingAdminRequests] = await Promise.all([
        apiFetch("/api/content-requests/pending"),
        apiFetch("/api/content-admins"),
        apiFetch("/api/content-admin-requests/pending")
      ]);
      setContentRequests(requests);
      setAdminProfiles(admins);
      setAdminRequests(pendingAdminRequests);
    } else {
      const requests = await apiFetch("/api/content-requests/mine");
      setContentRequests(requests);
      setAdminProfiles([]);
      setAdminRequests([]);
    }
  }

  async function loadContentRows() {
    const entries = await Promise.all(
      COLLECTIONS.map(async (collection) => [
        collection.key,
        await apiFetch(`/api/content/${collection.key}`)
      ])
    );
    setRecords(Object.fromEntries(entries));
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

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
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
        throw new Error(await response.text());
      }

      const result = await response.json();
      const uploadedUrl = result.url ?? result.Url;
      const safeUrl = isVideo ? safeMediaUrl(uploadedUrl) : safeImageUrl(uploadedUrl);
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
      await refreshDashboard();
    } catch (err) {
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    }
  }

  async function approveRequest(requestId) {
    if (!isSuperAdmin) return;

    try {
      await apiFetch(`/api/content-requests/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify({ reviewNote: reviewNote.trim() || "Approved for public site" })
      });
      setReviewNote("");
      await refreshDashboard();
    } catch (err) {
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    }
  }

  async function denyRequest(requestId) {
    if (!isSuperAdmin) return;

    try {
      await apiFetch(`/api/content-requests/${requestId}/deny`, {
        method: "POST",
        body: JSON.stringify({ reviewNote: reviewNote.trim() || "Denied by super admin" })
      });
      setReviewNote("");
      await refreshDashboard();
    } catch (err) {
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    }
  }

  async function cancelRequest(requestId) {
    try {
      await apiFetch(`/api/content-requests/${requestId}/cancel`, { method: "POST" });
      await refreshDashboard();
    } catch (err) {
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    }
  }

  async function removePublicRecord(record) {
    if (!isSuperAdmin) return;

    try {
      await apiFetch(`/api/content/${activeCollection.key}/${record[activeCollection.idKey]}`, {
        method: "DELETE"
      });
      await refreshDashboard();
    } catch (err) {
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    }
  }

  async function approveAdminRequest(requestId) {
    try {
      await apiFetch(`/api/content-admin-requests/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify({ reviewNote: reviewNote.trim() || "Approved as content admin" })
      });
      setReviewNote("");
      await refreshDashboard();
    } catch (err) {
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    }
  }

  async function denyAdminRequest(requestId) {
    try {
      await apiFetch(`/api/content-admin-requests/${requestId}/deny`, {
        method: "POST",
        body: JSON.stringify({ reviewNote: reviewNote.trim() || "Denied by super admin" })
      });
      setReviewNote("");
      await refreshDashboard();
    } catch (err) {
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    }
  }

  function beginKickContentAdmin(profile) {
    setError("");
    setNotice("");
    setKickConfirmation(profile);
    setKickPassword("");
  }

  function cancelKickContentAdmin() {
    setKickConfirmation(null);
    setKickPassword("");
  }

  async function kickContentAdmin(event) {
    event.preventDefault();
    if (!kickConfirmation) return;

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
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    }
  }

  async function loadAudit(userId) {
    try {
      setSelectedAuditUserId(userId);
      setAuditLogs(await apiFetch(`/api/content-admins/${userId}/audit`));
    } catch (err) {
      if (!handleAdminAccessError(err)) {
        setError(err.message);
      }
    }
  }

  if (isLoading) {
    return <p className="admin-empty-state">Loading admin dashboard...</p>;
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

      <section className="admin-shell">
        {error && <p className="admin-login-error">{error}</p>}
        {notice && <p className="admin-empty-state">{notice}</p>}

        <div className="admin-summary" aria-label="Dashboard summary">
          <div className="admin-summary-item">
            <span>Public rows</span>
            <strong>{publicCount}</strong>
          </div>
          <div className="admin-summary-item">
            <span>Pending review</span>
            <strong className={pendingRequests.length > 0 ? "admin-pending-count" : ""}>
              {pendingRequests.length}
            </strong>
          </div>
          <div className="admin-summary-item">
            <span>Active content admins</span>
            <strong>{adminProfiles.length}</strong>
          </div>
        </div>

        <div className="admin-workspace">
          <aside className="admin-sidebar" aria-label="Admin sections">
            {COLLECTIONS.map((collection) => (
              <button
                key={collection.key}
                type="button"
                className={collection.key === activeKey ? "active" : undefined}
                onClick={() => {
                  setActiveKey(collection.key);
                  setEditingRecord(null);
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
              <Link className="action-link" href={activeCollection.route}>
                <span>View Page</span>
              </Link>
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
              {activeCollection.fields.map((field) => (
                <label
                  className={
                    field.type === "textarea" || field.type === "songRows"
                      ? "admin-form-wide"
                      : undefined
                  }
                  key={field.key}
                >
                  <span>{field.label}</span>
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
                            ? safeMediaUrl(activeDraft[field.key])
                            : safeImageUrl(activeDraft[field.key]))
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
                        ? safeMediaUrl(activeDraft[field.key])
                        : safeImageUrl(activeDraft[field.key])) ? (
                        <small>
                          Stored {field.type === "media" ? "media" : "image"}:{" "}
                          <a
                            href={
                              field.type === "media"
                                ? safeMediaUrl(activeDraft[field.key])
                                : safeImageUrl(activeDraft[field.key])
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
                      <small>Visible on public site</small>
                    </div>
                    <div className="admin-record-actions">
                      <button type="button" onClick={() => beginEditRecord(record)}>
                        Edit
                      </button>
                      {isSuperAdmin && (
                        <button type="button" onClick={() => removePublicRecord(record)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <p className="admin-empty-state">No approved public rows yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="admin-review-panel">
          <div className="admin-editor-heading">
            <div>
              <h3>ContentChangeRequests</h3>
              <p>Normal users and content admins wait here until a super admin reviews them.</p>
            </div>
          </div>

          {isSuperAdmin && (
            <label className="admin-review-note">
              <span>Review note</span>
              <input
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Optional approval or denial note"
              />
            </label>
          )}

          <div className="admin-record-list">
            {visibleRequests.length ? (
              visibleRequests.map((request) => {
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
                      {action === "Update" && (
                        <div className="admin-change-preview">
                          {changedFields.length ? (
                            changedFields.map((field) => (
                              <div className="admin-change-row" key={field.key}>
                                <span>{field.label}</span>
                                <del>{formatPreviewValue(field.before)}</del>
                                <strong>{formatPreviewValue(field.after)}</strong>
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
                              <strong>{formatPreviewValue(payload[field.key])}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                      {action === "Delete" && targetRecord && (
                        <div className="admin-change-preview">
                          <small>Will remove {collection?.title(targetRecord)} from the public site.</small>
                        </div>
                      )}
                      {request.reviewNote ? <small>{request.reviewNote}</small> : null}
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
                      {!isSuperAdmin && status === "Pending" && (
                        <button type="button" onClick={() => cancelRequest(request.id)}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="admin-empty-state">No content change requests.</p>
            )}
          </div>
        </div>

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
            </div>

            <div className="admin-review-panel">
              <div className="admin-editor-heading">
                <div>
                  <h3>Content Admins</h3>
                  <p>Kick removes the ContentAdmin role and deletes their admin profile.</p>
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
                  <p className="admin-empty-state">No active content admins.</p>
                )}
              </div>
            </div>

            {selectedAuditUserId && (
              <div className="admin-review-panel">
                <div className="admin-editor-heading">
                  <div>
                    <h3>Audit Log</h3>
                    <p>{selectedAuditUserId}</p>
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
                            {log.entityType ?? "Admin"} {log.entityId ?? ""}
                          </p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="admin-empty-state">No audit events for this admin yet.</p>
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
