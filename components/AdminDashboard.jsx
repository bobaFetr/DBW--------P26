"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminLogin from "./AdminLogin";

const STORAGE_KEY = "paralyze-admin-dashboard";
const SESSION_KEY = "paralyze-admin-session";

// Credentials are stored here because this app has no backend.
// In a production setup these should be replaced with a real auth service.
const ADMIN_USERS = [
  { username: "superadmin", password: "Super@2025", role: "super_admin" },
  { username: "admin", password: "Admin@2025", role: "admin" }
];

const COLLECTIONS = [
  {
    key: "concerts",
    label: "Concerts",
    route: "/concerts",
    primaryLabel: "Show title",
    metaLabel: "Date / location",
    detailLabel: "Show details",
    extraLabel: "Ticket or booking link",
    seed: [
      {
        title: "Upcoming Show Slot",
        meta: "Date TBA",
        detail: "Add venue, city, and ticket or contact details here when the next show is confirmed.",
        extra: ""
      }
    ]
  },
  {
    key: "albums",
    label: "Albums",
    route: "/albums",
    primaryLabel: "Album title",
    metaLabel: "Year / status",
    detailLabel: "Release notes",
    extraLabel: "Streaming link",
    seed: [
      {
        title: "Debut Release",
        meta: "Album placeholder",
        detail: "Add the release title, year, cover image, and a short summary of the record here.",
        extra: ""
      }
    ]
  },
  {
    key: "singles",
    label: "Singles",
    route: "/singles",
    primaryLabel: "Single title",
    metaLabel: "Release date / status",
    detailLabel: "Track notes",
    extraLabel: "Video or streaming link",
    seed: [
      {
        title: "Lead Single",
        meta: "Release placeholder",
        detail: "Add artwork, a short description, and direct links to the premiere or streaming platforms.",
        extra: ""
      }
    ]
  },
  {
    key: "merch",
    label: "Merch",
    route: "/merch",
    primaryLabel: "Item name",
    metaLabel: "Price / stock",
    detailLabel: "Item details",
    extraLabel: "Order link",
    seed: [
      {
        title: "Shirt Design",
        meta: "Mockup placeholder",
        detail: "Add front and back print previews with available sizes and pricing.",
        extra: ""
      }
    ]
  },
  {
    key: "news",
    label: "News",
    route: "/news",
    primaryLabel: "Headline",
    metaLabel: "Date / status",
    detailLabel: "News body",
    extraLabel: "Source or campaign link",
    seed: [
      {
        title: "Site Update",
        meta: "Now",
        detail: "The site now uses one shared navigation shell, cleaner entry points, and stronger accessibility defaults.",
        extra: ""
      }
    ]
  },
  {
    key: "timeline",
    label: "Timeline",
    route: "/timeline",
    primaryLabel: "Milestone title",
    metaLabel: "Milestone date",
    detailLabel: "Milestone details",
    extraLabel: "Archive link",
    seed: [
      {
        title: "BAND FOUNDED",
        meta: "December 27, 2024",
        detail: "The project was founded by Tonislav and Kris. The journey began with a shared vision to create powerful metal music.",
        extra: ""
      }
    ]
  },
  {
    key: "members",
    label: "Members",
    route: "/members",
    primaryLabel: "Member name",
    metaLabel: "Role",
    detailLabel: "Profile notes",
    extraLabel: "Photo or social link",
    seed: [
      {
        title: "Vocals",
        meta: "Member profile",
        detail: "Use this card for a photo, stage role, and one short line about style or influence.",
        extra: ""
      }
    ]
  },
  {
    key: "gallery",
    label: "Gallery",
    route: "/gallery",
    primaryLabel: "Image title",
    metaLabel: "Category",
    detailLabel: "Caption",
    extraLabel: "Image path or URL",
    seed: [
      {
        title: "Live Mood",
        meta: "Gallery item",
        detail: "Live photo or performance mood slot.",
        extra: ""
      }
    ]
  }
];

function createRecord(collectionKey, entry, index) {
  return {
    id: `${collectionKey}-${index}-${entry.title.toLowerCase().replace(/\W+/g, "-")}`,
    status: "Draft",
    ...entry
  };
}

function createInitialRecords() {
  return Object.fromEntries(
    COLLECTIONS.map((collection) => [
      collection.key,
      collection.seed.map((entry, index) => createRecord(collection.key, entry, index))
    ])
  );
}

function createInitialDrafts() {
  return Object.fromEntries(
    COLLECTIONS.map((collection) => [
      collection.key,
      {
        title: "",
        meta: "",
        detail: "",
        extra: ""
      }
    ])
  );
}

export default function AdminDashboard() {
  const [session, setSession] = useState(null); // { username, role }
  const [activeKey, setActiveKey] = useState(COLLECTIONS[0].key);
  const [records, setRecords] = useState(createInitialRecords);
  const [drafts, setDrafts] = useState(createInitialDrafts);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const savedSession = window.sessionStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch {
        // ignore invalid session
      }
    }

    const savedData = window.localStorage.getItem(STORAGE_KEY);

    if (savedData) {
      try {
        setRecords(JSON.parse(savedData));
      } catch {
        setRecords(createInitialRecords());
      }
    }

    setHasLoaded(true);
  }, []);

  function login(username, password) {
    const user = ADMIN_USERS.find(
      (u) => u.username === username && u.password === password
    );
    if (!user) return false;
    const sessionData = { username: user.username, role: user.role };
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    setSession(sessionData);
    return true;
  }

  function logout() {
    window.sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  const isSuperAdmin = session?.role === "super_admin";

  useEffect(() => {
    if (hasLoaded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
  }, [hasLoaded, records]);

  const activeCollection = useMemo(
    () => COLLECTIONS.find((collection) => collection.key === activeKey) ?? COLLECTIONS[0],
    [activeKey]
  );
  const activeRecords = records[activeCollection.key] ?? [];
  const activeDraft = drafts[activeCollection.key];
  const totalRecords = COLLECTIONS.reduce(
    (total, collection) => total + (records[collection.key]?.length ?? 0),
    0
  );
  const pendingCount = COLLECTIONS.reduce(
    (total, collection) =>
      total +
      (records[collection.key] ?? []).filter((r) => r.status === "Pending Review").length,
    0
  );

  function updateDraft(field, value) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [activeCollection.key]: {
        ...currentDrafts[activeCollection.key],
        [field]: value
      }
    }));
  }

  function addRecord(event) {
    event.preventDefault();

    const cleanedDraft = {
      title: activeDraft.title.trim(),
      meta: activeDraft.meta.trim(),
      detail: activeDraft.detail.trim(),
      extra: activeDraft.extra.trim()
    };

    if (!cleanedDraft.title || !cleanedDraft.detail) {
      return;
    }

    const nextRecord = {
      id: `${activeCollection.key}-${Date.now()}`,
      status: isSuperAdmin ? "Draft" : "Pending Review",
      createdBy: session.username,
      ...cleanedDraft
    };

    setRecords((currentRecords) => ({
      ...currentRecords,
      [activeCollection.key]: [nextRecord, ...(currentRecords[activeCollection.key] ?? [])]
    }));
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [activeCollection.key]: {
        title: "",
        meta: "",
        detail: "",
        extra: ""
      }
    }));
  }

  function removeRecord(recordId) {
    const record = (records[activeCollection.key] ?? []).find((r) => r.id === recordId);
    if (!record) return;
    if (!isSuperAdmin) {
      if (record.status !== "Pending Review" || record.createdBy !== session.username) return;
    }
    setRecords((currentRecords) => ({
      ...currentRecords,
      [activeCollection.key]: (currentRecords[activeCollection.key] ?? []).filter(
        (record) => record.id !== recordId
      )
    }));
  }

  function toggleStatus(recordId) {
    if (!isSuperAdmin) return;
    setRecords((currentRecords) => ({
      ...currentRecords,
      [activeCollection.key]: (currentRecords[activeCollection.key] ?? []).map((record) =>
        record.id === recordId
          ? { ...record, status: record.status === "Draft" ? "Ready" : "Draft" }
          : record
      )
    }));
  }

  function approveRecord(recordId) {
    setRecords((currentRecords) => ({
      ...currentRecords,
      [activeCollection.key]: (currentRecords[activeCollection.key] ?? []).map((record) =>
        record.id === recordId ? { ...record, status: "Draft" } : record
      )
    }));
  }

  function resetDashboard() {
    setRecords(createInitialRecords());
    setDrafts(createInitialDrafts());
  }

  if (!session) {
    return <AdminLogin onLogin={login} />;
  }

  return (
    <>
      <section className="page-intro admin-intro">
        <span className="eyebrow">Admin</span>
        <h2 className="section-title">Content Dashboard</h2>
        <p>Drafts save in this browser until a database or CMS is connected.</p>
      </section>

      <div className="admin-toolbar">
        <div className="admin-role-info">
          <span>Signed in as <strong>{session.username}</strong></span>
          <span
            className={`admin-role-badge ${isSuperAdmin ? "admin-role-badge--super" : ""}`}
          >
            {isSuperAdmin ? "Super Admin" : "Admin"}
          </span>
        </div>
        <button type="button" className="admin-logout-btn" onClick={logout}>
          Sign Out
        </button>
      </div>

      <section className="admin-shell">
        <div className="admin-summary" aria-label="Dashboard summary">
          <div className="admin-summary-item">
            <span>Collections</span>
            <strong>{COLLECTIONS.length}</strong>
          </div>
          <div className="admin-summary-item">
            <span>Total rows</span>
            <strong>{totalRecords}</strong>
          </div>
          {isSuperAdmin ? (
            <div className="admin-summary-item">
              <span>Pending Review</span>
              <strong className={pendingCount > 0 ? "admin-pending-count" : ""}>
                {pendingCount}
              </strong>
            </div>
          ) : (
            <div className="admin-summary-item">
              <span>Active</span>
              <strong>{activeCollection.label}</strong>
            </div>
          )}
        </div>

        <div className="admin-workspace">
          <aside className="admin-sidebar" aria-label="Admin sections">
            {COLLECTIONS.map((collection) => (
              <button
                key={collection.key}
                type="button"
                className={collection.key === activeKey ? "active" : undefined}
                onClick={() => setActiveKey(collection.key)}
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
                <p>{activeRecords.length} saved draft rows</p>
              </div>
              <Link className="action-link" href={activeCollection.route}>
                <span>View Page</span>
              </Link>
            </div>

            <form className="admin-form" onSubmit={addRecord}>
              <label>
                <span>{activeCollection.primaryLabel}</span>
                <input
                  value={activeDraft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  placeholder={activeCollection.primaryLabel}
                  required
                />
              </label>
              <label>
                <span>{activeCollection.metaLabel}</span>
                <input
                  value={activeDraft.meta}
                  onChange={(event) => updateDraft("meta", event.target.value)}
                  placeholder={activeCollection.metaLabel}
                />
              </label>
              <label>
                <span>{activeCollection.extraLabel}</span>
                <input
                  value={activeDraft.extra}
                  onChange={(event) => updateDraft("extra", event.target.value)}
                  placeholder={activeCollection.extraLabel}
                />
              </label>
              <label className="admin-form-wide">
                <span>{activeCollection.detailLabel}</span>
                <textarea
                  value={activeDraft.detail}
                  onChange={(event) => updateDraft("detail", event.target.value)}
                  placeholder={activeCollection.detailLabel}
                  rows={4}
                  required
                />
              </label>
              <div className="admin-actions">
                <button type="submit">{isSuperAdmin ? "Add Draft" : "Submit for Review"}</button>
                {isSuperAdmin && (
                  <button type="button" onClick={resetDashboard}>
                    Reset Seed Data
                  </button>
                )}
              </div>
            </form>

            <div className="admin-record-list" aria-live="polite">
              {activeRecords.length ? (
                activeRecords.map((record) => (
                  <article className="admin-record" key={record.id}>
                    <div>
                      <div className="admin-record-topline">
                        <h4>{record.title}</h4>
                        <span className={record.status === "Pending Review" ? "status-pending" : undefined}>
                          {record.status}
                        </span>
                      </div>
                      {record.meta ? <p className="meta">{record.meta}</p> : null}
                      <p>{record.detail}</p>
                      {record.extra ? <small>{record.extra}</small> : null}
                    </div>
                    <div className="admin-record-actions">
                      {isSuperAdmin && record.status === "Pending Review" && (
                        <>
                          <button type="button" onClick={() => approveRecord(record.id)}>
                            Approve
                          </button>
                          <button type="button" onClick={() => removeRecord(record.id)}>
                            Reject
                          </button>
                        </>
                      )}
                      {isSuperAdmin && record.status !== "Pending Review" && (
                        <>
                          <button type="button" onClick={() => toggleStatus(record.id)}>
                            Toggle Status
                          </button>
                          <button type="button" onClick={() => removeRecord(record.id)}>
                            Remove
                          </button>
                        </>
                      )}
                      {!isSuperAdmin && record.status === "Pending Review" && (
                        <button type="button" onClick={() => removeRecord(record.id)}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <p className="admin-empty-state">No drafts yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="admin-export">
          <h3>Export JSON</h3>
          <textarea readOnly value={JSON.stringify(records, null, 2)} rows={10} />
        </div>
      </section>
    </>
  );
}
