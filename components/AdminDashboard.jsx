"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "paralyze-admin-dashboard";

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
  const [activeKey, setActiveKey] = useState(COLLECTIONS[0].key);
  const [records, setRecords] = useState(createInitialRecords);
  const [drafts, setDrafts] = useState(createInitialDrafts);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
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
      status: "Draft",
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
    setRecords((currentRecords) => ({
      ...currentRecords,
      [activeCollection.key]: (currentRecords[activeCollection.key] ?? []).filter(
        (record) => record.id !== recordId
      )
    }));
  }

  function toggleStatus(recordId) {
    setRecords((currentRecords) => ({
      ...currentRecords,
      [activeCollection.key]: (currentRecords[activeCollection.key] ?? []).map((record) =>
        record.id === recordId
          ? { ...record, status: record.status === "Draft" ? "Ready" : "Draft" }
          : record
      )
    }));
  }

  function resetDashboard() {
    setRecords(createInitialRecords());
  }

  return (
    <>
      <section className="page-intro admin-intro">
        <span className="eyebrow">Admin</span>
        <h2 className="section-title">Content Dashboard</h2>
        <p>Drafts save in this browser until a database or CMS is connected.</p>
      </section>

      <section className="admin-shell">
        <div className="admin-summary" aria-label="Dashboard summary">
          <div className="admin-summary-item">
            <span>Collections</span>
            <strong>{COLLECTIONS.length}</strong>
          </div>
          <div className="admin-summary-item">
            <span>Draft rows</span>
            <strong>{totalRecords}</strong>
          </div>
          <div className="admin-summary-item">
            <span>Active</span>
            <strong>{activeCollection.label}</strong>
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
                <button type="submit">Add Draft</button>
                <button type="button" onClick={resetDashboard}>
                  Reset Seed Data
                </button>
              </div>
            </form>

            <div className="admin-record-list" aria-live="polite">
              {activeRecords.length ? (
                activeRecords.map((record) => (
                  <article className="admin-record" key={record.id}>
                    <div>
                      <div className="admin-record-topline">
                        <h4>{record.title}</h4>
                        <span>{record.status}</span>
                      </div>
                      {record.meta ? <p className="meta">{record.meta}</p> : null}
                      <p>{record.detail}</p>
                      {record.extra ? <small>{record.extra}</small> : null}
                    </div>
                    <div className="admin-record-actions">
                      <button type="button" onClick={() => toggleStatus(record.id)}>
                        Toggle Status
                      </button>
                      <button type="button" onClick={() => removeRecord(record.id)}>
                        Remove
                      </button>
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
