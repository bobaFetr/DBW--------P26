"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminLogin from "./AdminLogin";

const STORAGE_KEY = "paralyze-admin-infrastructure";
const SESSION_KEY = "paralyze-admin-session";

const ADMIN_USERS = [
  {
    userId: "superadmin-user",
    username: "superadmin",
    password: "Super@2025",
    displayName: "Super Admin",
    adminCode: "SADM-000001",
    adminKind: "SuperAdmin",
    role: "super_admin"
  },
  {
    userId: "contentadmin-user",
    username: "admin",
    password: "Admin@2025",
    displayName: "Content Admin",
    adminCode: "CADM-000001",
    adminKind: "ContentAdmin",
    role: "content_admin"
  }
];

const COLLECTIONS = [
  {
    key: "concerts",
    label: "Concerts",
    dbSet: "Concerts",
    entity: "Concerts",
    route: "/concerts",
    fields: [
      { key: "date", label: "Date", required: true, type: "date" },
      { key: "location", label: "Location", required: true },
      { key: "time", label: "Time", type: "time" },
      { key: "numberOfSongs", label: "Number of songs", type: "number" }
    ],
    seed: [
      {
        date: "2026-08-16",
        location: "Venue TBA",
        time: "",
        numberOfSongs: "0"
      }
    ],
    title: (record) => record.location,
    meta: (record) => [record.date, record.time].filter(Boolean).join(" at "),
    detail: (record) => `${record.numberOfSongs || "0"} songs planned`
  },
  {
    key: "albums",
    label: "Albums",
    dbSet: "Albums",
    entity: "Albums",
    route: "/albums",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "releaseDate", label: "Release date", type: "date" },
      { key: "numberOfSongs", label: "Number of songs", type: "number" }
    ],
    seed: [
      {
        title: "Debut Release",
        releaseDate: "",
        numberOfSongs: "0"
      }
    ],
    title: (record) => record.title,
    meta: (record) => record.releaseDate || "Release date TBA",
    detail: (record) => `${record.numberOfSongs || "0"} songs`
  },
  {
    key: "singles",
    label: "Singles",
    dbSet: "Singles",
    entity: "Singles",
    route: "/singles",
    fields: [
      { key: "songName", label: "Song name", required: true },
      { key: "releaseDate", label: "Release date", type: "date" },
      { key: "availableOnYoutube", label: "YouTube URL" },
      { key: "availableOnSpotify", label: "Spotify URL" },
      { key: "albumId", label: "Album ID", type: "number" }
    ],
    seed: [
      {
        songName: "Lead Single",
        releaseDate: "",
        availableOnYoutube: "",
        availableOnSpotify: "",
        albumId: ""
      }
    ],
    title: (record) => record.songName,
    meta: (record) => record.releaseDate || "Release date TBA",
    detail: (record) =>
      [record.availableOnYoutube && "YouTube", record.availableOnSpotify && "Spotify"]
        .filter(Boolean)
        .join(" / ") || "Streaming links pending"
  },
  {
    key: "news",
    label: "News",
    dbSet: "News",
    entity: "News",
    route: "/news",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "publicationDate", label: "Publication date", required: true, type: "date" },
      { key: "author", label: "Author", required: true },
      { key: "content", label: "Content", required: true, type: "textarea" }
    ],
    seed: [
      {
        title: "Site Update",
        publicationDate: "2026-06-06",
        author: "Paralyze",
        content: "The public pages should show approved content only."
      }
    ],
    title: (record) => record.title,
    meta: (record) => [record.publicationDate, record.author].filter(Boolean).join(" / "),
    detail: (record) => record.content
  },
  {
    key: "timeline",
    label: "Timeline",
    dbSet: "TimeLines",
    entity: "TimeLine",
    route: "/timeline",
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "event", label: "Event", required: true },
      { key: "location", label: "Location" },
      { key: "description", label: "Description", required: true, type: "textarea" }
    ],
    seed: [
      {
        date: "2024-12-27",
        event: "BAND FOUNDED",
        location: "",
        description: "The project was founded by Tonislav and Kris."
      }
    ],
    title: (record) => record.event,
    meta: (record) => [record.date, record.location].filter(Boolean).join(" / "),
    detail: (record) => record.description
  },
  {
    key: "members",
    label: "Members",
    dbSet: "Members",
    entity: "Members",
    route: "/members",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "instrument", label: "Instrument", required: true },
      { key: "photoUrl", label: "Photo URL", required: true }
    ],
    seed: [
      {
        name: "Vocals",
        instrument: "Member profile",
        photoUrl: "/BUntitled.png"
      }
    ],
    title: (record) => record.name,
    meta: (record) => record.instrument,
    detail: (record) => record.photoUrl
  },
  {
    key: "gallery",
    label: "Gallery",
    dbSet: "Gallery",
    entity: "Gallery",
    route: "/gallery",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "imageUrl", label: "Image URL", required: true },
      { key: "description", label: "Description", type: "textarea" }
    ],
    seed: [
      {
        title: "Live Mood",
        imageUrl: "/BUntitled.png",
        description: "Live photo or performance mood slot."
      }
    ],
    title: (record) => record.title,
    meta: (record) => record.imageUrl,
    detail: (record) => record.description
  }
];

function emptyDraft(collection) {
  return Object.fromEntries(collection.fields.map((field) => [field.key, ""]));
}

function createInitialDrafts() {
  return Object.fromEntries(
    COLLECTIONS.map((collection) => [collection.key, emptyDraft(collection)])
  );
}

function createRecord(collection, entry, index) {
  return {
    id: `${collection.key}-${index + 1}`,
    entity: collection.entity,
    dbSet: collection.dbSet,
    status: "Approved",
    isPublic: true,
    createdByUserId: "superadmin-user",
    approvedBySuperAdminId: "superadmin-user",
    approvedAtUtc: new Date().toISOString(),
    ...entry
  };
}

function createInitialRecords() {
  return Object.fromEntries(
    COLLECTIONS.map((collection) => [
      collection.key,
      collection.seed.map((entry, index) => createRecord(collection, entry, index))
    ])
  );
}

function createInitialAdminProfiles() {
  return ADMIN_USERS.map((user) => ({
    id: `${user.adminCode.toLowerCase()}-profile`,
    userId: user.userId,
    displayName: user.displayName,
    username: user.username,
    adminCode: user.adminCode,
    adminKind: user.adminKind,
    isActive: true,
    approvedAtUtc: new Date().toISOString(),
    approvedByUserId: user.adminKind === "SuperAdmin" ? null : "superadmin-user",
    disabledAtUtc: null,
    disabledByUserId: null
  }));
}

function createChangeCode(number) {
  return `CHG-${String(number).padStart(6, "0")}`;
}

function createReviewRequest(collection, payload, session, requestNumber) {
  return {
    id: `content-change-${Date.now()}`,
    changeCode: createChangeCode(requestNumber),
    requestedByUserId: session.userId,
    requestedByAdminCode: session.adminCode,
    requestedByDisplayName: session.displayName,
    contentType: collection.entity,
    dbSet: collection.dbSet,
    targetEntityId: null,
    action: "Create",
    status: "Pending",
    payloadJson: JSON.stringify(payload),
    message: `Create ${collection.label} content`,
    requestedAtUtc: new Date().toISOString(),
    reviewedBySuperAdminId: null,
    reviewedAtUtc: null,
    reviewNote: null
  };
}

export default function AdminDashboard() {
  const [session, setSession] = useState(null);
  const [activeKey, setActiveKey] = useState(COLLECTIONS[0].key);
  const [records, setRecords] = useState(createInitialRecords);
  const [drafts, setDrafts] = useState(createInitialDrafts);
  const [contentRequests, setContentRequests] = useState([]);
  const [adminProfiles, setAdminProfiles] = useState(createInitialAdminProfiles);
  const [reviewNote, setReviewNote] = useState("");
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
        const parsed = JSON.parse(savedData);
        setRecords(parsed.records ?? createInitialRecords());
        setDrafts(parsed.drafts ?? createInitialDrafts());
        setContentRequests(parsed.contentRequests ?? []);
        setAdminProfiles(parsed.adminProfiles ?? createInitialAdminProfiles());
      } catch {
        setRecords(createInitialRecords());
      }
    }

    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (hasLoaded) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ records, drafts, contentRequests, adminProfiles })
      );
    }
  }, [adminProfiles, contentRequests, drafts, hasLoaded, records]);

  function login(username, password) {
    const user = ADMIN_USERS.find(
      (u) => u.username === username && u.password === password
    );
    const profile = adminProfiles.find((p) => p.userId === user?.userId);

    if (!user || !profile?.isActive) return false;

    const sessionData = {
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      adminKind: user.adminKind,
      adminCode: user.adminCode
    };

    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    setSession(sessionData);
    return true;
  }

  function logout() {
    window.sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  const isSuperAdmin = session?.adminKind === "SuperAdmin";
  const activeCollection = useMemo(
    () => COLLECTIONS.find((collection) => collection.key === activeKey) ?? COLLECTIONS[0],
    [activeKey]
  );
  const activeRecords = records[activeCollection.key] ?? [];
  const activeDraft = drafts[activeCollection.key] ?? emptyDraft(activeCollection);
  const pendingRequests = contentRequests.filter((request) => request.status === "Pending");
  const visibleRequests = isSuperAdmin
    ? contentRequests
    : contentRequests.filter((request) => request.requestedByUserId === session?.userId);
  const publicCount = COLLECTIONS.reduce(
    (total, collection) =>
      total + (records[collection.key] ?? []).filter((record) => record.isPublic).length,
    0
  );
  const contentAdminCount = adminProfiles.filter(
    (profile) => profile.adminKind === "ContentAdmin" && profile.isActive
  ).length;

  function updateDraft(field, value) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [activeCollection.key]: {
        ...currentDrafts[activeCollection.key],
        [field]: value
      }
    }));
  }

  function addContent(event) {
    event.preventDefault();

    const cleanedDraft = Object.fromEntries(
      activeCollection.fields.map((field) => [
        field.key,
        String(activeDraft[field.key] ?? "").trim()
      ])
    );
    const hasMissingRequired = activeCollection.fields.some(
      (field) => field.required && !cleanedDraft[field.key]
    );

    if (hasMissingRequired) return;

    if (isSuperAdmin) {
      const nextRecord = {
        id: `${activeCollection.key}-${Date.now()}`,
        entity: activeCollection.entity,
        dbSet: activeCollection.dbSet,
        status: "Approved",
        isPublic: true,
        createdByUserId: session.userId,
        approvedBySuperAdminId: session.userId,
        approvedAtUtc: new Date().toISOString(),
        ...cleanedDraft
      };

      setRecords((currentRecords) => ({
        ...currentRecords,
        [activeCollection.key]: [nextRecord, ...(currentRecords[activeCollection.key] ?? [])]
      }));
    } else {
      setContentRequests((currentRequests) => [
        createReviewRequest(activeCollection, cleanedDraft, session, currentRequests.length + 1),
        ...currentRequests
      ]);
    }

    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [activeCollection.key]: emptyDraft(activeCollection)
    }));
  }

  function approveRequest(requestId) {
    const request = contentRequests.find((item) => item.id === requestId);
    if (!request || !isSuperAdmin) return;

    const collection = COLLECTIONS.find((item) => item.entity === request.contentType);
    if (!collection) return;

    const payload = JSON.parse(request.payloadJson);
    const approvedRecord = {
      id: `${collection.key}-${Date.now()}`,
      entity: collection.entity,
      dbSet: collection.dbSet,
      status: "Approved",
      isPublic: true,
      createdByUserId: request.requestedByUserId,
      approvedBySuperAdminId: session.userId,
      approvedAtUtc: new Date().toISOString(),
      ...payload
    };

    setRecords((currentRecords) => ({
      ...currentRecords,
      [collection.key]: [approvedRecord, ...(currentRecords[collection.key] ?? [])]
    }));
    setContentRequests((currentRequests) =>
      currentRequests.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: "Approved",
              reviewedBySuperAdminId: session.userId,
              reviewedAtUtc: new Date().toISOString(),
              reviewNote: reviewNote.trim() || "Approved for public site"
            }
          : item
      )
    );
    setReviewNote("");
  }

  function denyRequest(requestId) {
    if (!isSuperAdmin) return;

    setContentRequests((currentRequests) =>
      currentRequests.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: "Denied",
              reviewedBySuperAdminId: session.userId,
              reviewedAtUtc: new Date().toISOString(),
              reviewNote: reviewNote.trim() || "Denied by superadmin"
            }
          : item
      )
    );
    setReviewNote("");
  }

  function cancelRequest(requestId) {
    setContentRequests((currentRequests) =>
      currentRequests.map((item) =>
        item.id === requestId && item.requestedByUserId === session.userId
          ? { ...item, status: "Cancelled" }
          : item
      )
    );
  }

  function removePublicRecord(recordId) {
    if (!isSuperAdmin) return;

    setRecords((currentRecords) => ({
      ...currentRecords,
      [activeCollection.key]: (currentRecords[activeCollection.key] ?? []).filter(
        (record) => record.id !== recordId
      )
    }));
  }

  function toggleContentAdmin(userId) {
    if (!isSuperAdmin) return;

    setAdminProfiles((currentProfiles) =>
      currentProfiles.map((profile) =>
        profile.userId === userId && profile.adminKind === "ContentAdmin"
          ? {
              ...profile,
              isActive: !profile.isActive,
              disabledAtUtc: profile.isActive ? new Date().toISOString() : null,
              disabledByUserId: profile.isActive ? session.userId : null
            }
          : profile
      )
    );
  }

  function resetDashboard() {
    setRecords(createInitialRecords());
    setDrafts(createInitialDrafts());
    setContentRequests([]);
    setAdminProfiles(createInitialAdminProfiles());
  }

  if (!session) {
    return <AdminLogin onLogin={login} />;
  }

  return (
    <>
      <section className="page-intro admin-intro">
        <span className="eyebrow">Admin</span>
        <h2 className="section-title">Content Approval Dashboard</h2>
        <p>Content admins submit database-backed changes. The public site uses approved rows.</p>
      </section>

      <div className="admin-toolbar">
        <div className="admin-role-info">
          <span>
            Signed in as <strong>{session.displayName}</strong>
          </span>
          <span
            className={`admin-role-badge ${isSuperAdmin ? "admin-role-badge--super" : ""}`}
          >
            {isSuperAdmin ? "Super Admin" : "Content Admin"}
          </span>
          <span>{session.adminCode}</span>
        </div>
        <button type="button" className="admin-logout-btn" onClick={logout}>
          Sign Out
        </button>
      </div>

      <section className="admin-shell">
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
            <strong>{contentAdminCount}</strong>
          </div>
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
                <p>
                  DbSet: {activeCollection.dbSet} / Entity: {activeCollection.entity}
                </p>
              </div>
              <Link className="action-link" href={activeCollection.route}>
                <span>View Page</span>
              </Link>
            </div>

            <form className="admin-form" onSubmit={addContent}>
              {activeCollection.fields.map((field) => (
                <label
                  className={field.type === "textarea" ? "admin-form-wide" : undefined}
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
                  {isSuperAdmin ? "Publish Approved Row" : "Submit Change Request"}
                </button>
                {isSuperAdmin && (
                  <button type="button" onClick={resetDashboard}>
                    Reset Mock Data
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
                        <h4>{activeCollection.title(record)}</h4>
                        <span className="status-approved">Approved</span>
                      </div>
                      <p className="meta">{activeCollection.meta(record)}</p>
                      <p>{activeCollection.detail(record)}</p>
                      <small>Visible on public site</small>
                    </div>
                    {isSuperAdmin && (
                      <div className="admin-record-actions">
                        <button type="button" onClick={() => removePublicRecord(record.id)}>
                          Remove
                        </button>
                      </div>
                    )}
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
              <p>Pending content admin changes wait here until a superadmin reviews them.</p>
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
                  (item) => item.entity === request.contentType
                );
                const payload = JSON.parse(request.payloadJson);

                return (
                  <article className="admin-record" key={request.id}>
                    <div>
                      <div className="admin-record-topline">
                        <h4>{request.changeCode}</h4>
                        <span className={`status-${request.status.toLowerCase()}`}>
                          {request.status}
                        </span>
                      </div>
                      <p className="meta">
                        {request.action} {request.contentType} by{" "}
                        {request.requestedByDisplayName}
                      </p>
                      <p>{collection?.title(payload) ?? request.message}</p>
                      {request.reviewNote ? <small>{request.reviewNote}</small> : null}
                    </div>
                    <div className="admin-record-actions">
                      {isSuperAdmin && request.status === "Pending" && (
                        <>
                          <button type="button" onClick={() => approveRequest(request.id)}>
                            Approve
                          </button>
                          <button type="button" onClick={() => denyRequest(request.id)}>
                            Deny
                          </button>
                        </>
                      )}
                      {!isSuperAdmin && request.status === "Pending" && (
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
          <div className="admin-review-panel">
            <div className="admin-editor-heading">
              <div>
                <h3>AdminProfiles</h3>
                <p>One superadmin can manage active content admins.</p>
              </div>
            </div>
            <div className="admin-record-list">
              {adminProfiles.map((profile) => (
                <article className="admin-record" key={profile.id}>
                  <div>
                    <div className="admin-record-topline">
                      <h4>{profile.displayName}</h4>
                      <span>{profile.adminKind}</span>
                    </div>
                    <p className="meta">
                      {profile.adminCode} / {profile.isActive ? "Active" : "Disabled"}
                    </p>
                  </div>
                  {profile.adminKind === "ContentAdmin" && (
                    <div className="admin-record-actions">
                      <button type="button" onClick={() => toggleContentAdmin(profile.userId)}>
                        {profile.isActive ? "Disable" : "Enable"}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="admin-export">
          <h3>Infrastructure JSON</h3>
          <textarea
            readOnly
            value={JSON.stringify(
              {
                adminProfiles,
                contentChangeRequests: contentRequests,
                publicContent: records
              },
              null,
              2
            )}
            rows={10}
          />
        </div>
      </section>
    </>
  );
}
