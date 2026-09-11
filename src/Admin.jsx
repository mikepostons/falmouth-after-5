import React, { useEffect, useState, useRef, createContext, useContext, Suspense, lazy } from "react";
import { api } from "./api";
import Icon from "./icons";
import AdminSelect from "./AdminSelect";
import PhotoDropzone from "./PhotoDropzone";
import SubmissionTable from "./SubmissionTable";
import AdminUsers, { AccountActivation } from "./AdminUsers";
import { Dialog, CategoryPills } from "./main";
import { firstFriday, dateLabel, campaignOccurrences } from "./domain";
const MapView = lazy(() =>
  import("./MapView").catch(() => ({
    default: () => (
      <p className="notice">
        The map could not load. Enter latitude and longitude above, or reload to
        try again.
      </p>
    ),
  })),
);
const names = {
  offers: "Offers",
  businesses: "Businesses",
  dates: "Campaigns",
  categories: "Categories",
  submissions: "Business submissions",
};
const palette = [
  "#cf167c",
  "#1269b0",
  "#28783b",
  "#9250b1",
  "#ae6200",
  "#00828f",
  "#414d62",
];
const defaults = {
  businesses: {
    name: "",
    address: "",
    description: "",
    lat: null,
    lng: null,
    website: "",
    booking: "",
    phone: "",
    facebook: "",
    instagram: "",
    image: "",
    image_alt: "",
    status: "draft",
  },
  offers: {
    title: "",
    business_id: "",
    description: "",
    terms: "",
    redemption: "",
    time_note: "",
    categories: [],
    occurrences: [],
    schedule_mode: "all",
    campaign_ids: [],
    roll_over: false,
    start_time: "17:00",
    end_time: "21:00",
    image: "",
    image_alt: "",
    status: "draft",
  },
  dates: { date: "", label: "", status: "draft" },
  categories: {
    name: "",
    colour: palette[0],
    icon: "drinks",
    sort: 5,
    active: true,
  },
};
function campaignLabel(d) {
  return d
    ? new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
      }).format(new Date(d.date + "T12:00:00"))
    : "Campaign";
}
function OfferCampaignStatus({ offer }) {
  const all = offer.schedule_mode === "all";
  const ids = new Set(
    offer.schedule_mode === "specific"
      ? offer.campaign_ids || []
      : (offer.occurrences || []).map((occurrence) => occurrence.date_id),
  );
  return (
    <div className="record-campaigns">
      <strong>{all ? "No specific dates" : ids.size ? "Specific campaigns" : "No campaigns selected"}</strong>
      <small>
        {all
          ? "All published campaigns"
          : `${ids.size} selected${offer.roll_over ? " · Roll-over on" : ""}`}
      </small>
    </div>
  );
}
const ValidationContext = createContext([]);
function Field({ label, children, hint }) {
  const issue = useContext(ValidationContext).find((item) => item.label === label);
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {issue && <small className="field-error" id={issue.id}>{issue.message}</small>}
    </label>
  );
}
export default function Admin() {
  const [validationIssues, setValidationIssues] = useState([]);
  const validationAttempted = useRef(false);
  const editorForm = useRef(null);
  const collectIssues = (form) => {
    const issues = [];
    for (const input of form.querySelectorAll("input, textarea, select")) {
      input.removeAttribute("aria-invalid");
      if (input.dataset.validationDescription) {
        input.removeAttribute("aria-describedby");
        delete input.dataset.validationDescription;
      }
      if (!input.willValidate || input.validity.valid) continue;
      const label = input.closest(".field")?.querySelector("span")?.textContent || input.getAttribute("aria-label") || "Field";
      const message = input.validity.valueMissing ? `${label} is required.` : input.validationMessage;
      const id = `editor-validation-${issues.length}`;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", id);
      input.dataset.validationDescription = "true";
      issues.push({ label, message, id, input });
    }
    setValidationIssues(issues);
    return issues;
  };
  const focusIssue = (issue) => {
    const panel = issue.input.closest("[data-editor-tab]");
    if (panel) setEditorTab(panel.dataset.editorTab);
    requestAnimationFrame(() => {
      issue.input.focus();
      issue.input.scrollIntoView({ block: "center", behavior: "instant" });
    });
  };

  const [session, setSession] = useState(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [data, setData] = useState(null),
    [config, setConfig] = useState(null),
    [tab, setTab] = useState("offers"),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [q, setQ] = useState(""),
    [account, setAccount] = useState(false),
    [dirty, setDirty] = useState(false),
    [confirmClose, setConfirmClose] = useState(false),
    [editorTab, setEditorTab] = useState("details"),
    [usersOpen, setUsersOpen] = useState(false);
  useEffect(() => {
    if (validationAttempted.current && editorForm.current) collectIssues(editorForm.current);
  }, [editing]);
  const load = async () => {
    const d = await api("admin");
    setData(d);
  };
  const refreshSession = async () => {
    try {
      const s = await api("session");
      setSession(s);
      if (s.user) await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setReady(true);
    }
  };
  useEffect(() => {
    refreshSession();
    api("public")
      .then((d) => setConfig(d.config))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const fn = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api("login", Object.fromEntries(f));
      await refreshSession();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const closeEditor = () => {
    if (dirty) {
      setConfirmClose(true);
      return;
    }
    setEditing(null);
    setDirty(false);
    setError("");
  };
  const update = (key, value) => {
    setEditing((v) => ({
      ...v,
      [key]: value,
      ...([
        "schedule_mode",
        "campaign_ids",
        "roll_over",
        "start_time",
        "end_time",
      ].includes(key)
        ? { legacy_schedule: false }
        : {}),
    }));
    setDirty(true);
  };
  const edit = (r) => {
    validationAttempted.current = false;
    setValidationIssues([]);
    setEditorTab("details");
    const copy = structuredClone(r);
    if (tab === "offers" && !copy.schedule_mode) {
      copy.legacy_schedule = true;
      copy.schedule_mode = copy.occurrences?.length ? "specific" : "all";
      copy.campaign_ids = [
        ...new Set((copy.occurrences || []).map((o) => o.date_id)),
      ];
      copy.roll_over = false;
      copy.start_time = copy.occurrences?.[0]?.start.slice(11, 16) || "17:00";
      copy.end_time = copy.occurrences?.[0]?.end.slice(11, 16) || "21:00";
    }
    setEditing(copy);
    setDirty(false);
    setError("");
    setMessage("");
  };
  const save = async (e) => {
    e.preventDefault();
    validationAttempted.current = true;
    const issues = collectIssues(e.currentTarget);
    if (issues.length) {
      setError("");
      focusIssue(issues[0]);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const record = { ...editing };
      if (record.legacy_schedule)
        for (const key of [
          "schedule_mode",
          "campaign_ids",
          "roll_over",
          "start_time",
          "end_time",
        ])
          delete record[key];
      delete record.legacy_schedule;
      await api("save", { kind: tab, record });
      await load();
      setEditing(null);
      setDirty(false);
      setMessage(
        editing.status === "published"
          ? "Saved as published. Offers appear on their applicable published campaigns when the business is also published."
          : "Changes saved.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const upload = async (file) => {
    if (!file || busy) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError("Choose a JPG, PNG or WebP photo up to 8 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const f = new FormData();
      f.set("image", file);
      const r = await api("upload", f);
      update("image", r.path);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (new URLSearchParams(location.search).has("activate"))
    return <AccountActivation />;
  if (!ready) return <div className="page-loading">Opening staff area…</div>;
  if (!session?.user)
    return (
      <main className="login-page">
        <a href="./">
          <img
            src="./assets/logo-falmouth-after-5-blue.svg"
            alt="Falmouth After Five"
          />
        </a>
        <form className="login-form" onSubmit={login}>
          <Icon name="lock" size={30} />
          <h1>
            A good evening
            <br />
            starts here.
          </h1>
          <p>Sign in to manage Falmouth BID’s businesses and offers.</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Field label="Email address">
            <input name="email" type="email" autoComplete="username" required />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <button className="button primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            <Icon name="right" />
          </button>
          <small>
            Need access or a password reset? Contact your website administrator.
          </small>
        </form>
        <a className="text-link" href="./">
          <Icon name="back" /> Back to the offers
        </a>
      </main>
    );
  const list =
    data?.[tab]?.filter((r) =>
      `${r.name || r.title || r.label} ${r.address || ""} ${tab === "submissions" ? `${r.contact || ""} ${r.email || ""} ${r.offer || ""}` : ""} ${tab === "offers" ? data.businesses.find((b) => b.id === r.business_id)?.name || "" : ""}`
        .toLowerCase()
        .includes(q.toLowerCase()),
    ) || [];
  const publicationStatus = editing ? (
    <Field label="Publication status">
      <AdminSelect
        value={editing.status}
        onChange={(e) => update("status", e.target.value)}
      >
        <option value="draft">Draft · staff only</option>
        <option value="published">
          Published · visible when its date and business are published
        </option>
        <option value="archived">Archived · hidden from visitors</option>
      </AdminSelect>
    </Field>
  ) : null;
  return (
    <div className="admin-app">
      {session.demo && (
        <div className="demo-banner">
          Local development · Changes are saved locally.
        </div>
      )}
      <header className="admin-header">
        <a href="./">
          <img
            src="./assets/logo-falmouth-after-5-blue.svg"
            alt="Falmouth After Five"
          />
        </a>
        <span>
          Falmouth BID <strong>Campaign manager</strong>
        </span>
        <div>
          <a className="button small secondary" href="./" target="_blank">
            View website <Icon name="external" />
          </a>
          <button
            className="icon-button"
            aria-label="Account settings"
            onClick={() => setAccount(true)}
          >
            <Icon name="settings" />
          </button>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              await api("logout", {});
              setData(null);
              await refreshSession();
            }}
          >
            <Icon name="logout" />
          </button>
        </div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <p>Hello, {session.user.name}</p>
          <nav aria-label="Campaign management">
            {session.user.role === "super-admin" && (
              <button onClick={() => setUsersOpen(true)}>
                <Icon name="lock" />
                Staff users
              </button>
            )}
            {Object.entries(names).map(([k, n]) => (
              <button
                className={tab === k ? "active" : ""}
                key={k}
                onClick={() => {
                  setTab(k);
                  setQ("");
                  setMessage("");
                  setError("");
                }}
              >
                <Icon
                  name={
                    {
                      offers: "ticket",
                      businesses: "pin",
                      dates: "calendar",
                      categories: "filter",
                      submissions: "list",
                    }[k]
                  }
                />
                {n}
                <span>{data?.[k]?.length || 0}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <Icon name="check" />
            <p>
              Draft, preview, publish.
              <br />
              You’re in control of what goes live.
            </p>
          </div>
        </aside>
        <main className="admin-main">
          <div className="admin-title">
            <div>
              <p className="eyebrow">YOUR FIRST FRIDAY TOOLKIT</p>
              <h1>{names[tab]}</h1>
            </div>
            {tab !== "submissions" && (
              <button
                className="button primary"
                onClick={() => edit(defaults[tab])}
              >
                <Icon name="plus" />
                Add{" "}
                {tab === "categories"
                  ? "category"
                  : tab === "businesses"
                    ? "business"
                    : tab === "dates"
                      ? "date"
                      : "offer"}
              </button>
            )}
          </div>
          {data?.visibility && !data.visibility.next_campaign && (
            <div className="notice" role="status">
              <strong>No upcoming offers are visible on the website.</strong>
              <p>
                Check that an upcoming campaign is published and has published
                offers from published businesses. Offers set to “No dates set”
                still need an upcoming published campaign.
              </p>
              <button
                type="button"
                className="button secondary small"
                onClick={() => {
                  setTab("dates");
                  setQ("");
                }}
              >
                Manage campaigns <Icon name="calendar" />
              </button>
            </div>
          )}
          {message && (
            <p className="success" role="status">
              <Icon name="check" />
              {message}
            </p>
          )}
          {error && !editing && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <label className="search-field admin-search">
            <Icon name="search" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${names[tab].toLowerCase()}`}
              aria-label={`Search ${names[tab].toLowerCase()}`}
            />
          </label>
          <div className="admin-records">
            {tab === "offers" && list.length > 0 && (
              <div className="admin-offers-heading" aria-hidden="true">
                <span>Offer</span><span>Campaigns</span><span>Status / actions</span>
              </div>
            )}
            {tab === "submissions" && <SubmissionTable records={list} data={data} onReload={load} />}
            {(tab === "submissions" ? [] : list).map((r) => (
                <div className={`admin-record${tab === "offers" ? " admin-offer-record" : ""}`} key={r.id}>
                  <div className="record-symbol">
                    <Icon
                      name={
                        tab === "categories"
                          ? r.icon
                          : tab === "dates"
                            ? "calendar"
                            : tab === "businesses"
                              ? "pin"
                              : "ticket"
                      }
                      size={24}
                    />
                  </div>
                  <div className="record-title">
                    <strong>{r.name || r.title || r.label}</strong>
                    <small>
                      {tab === "offers"
                        ? data.businesses.find((b) => b.id === r.business_id)
                            ?.name
                        : tab === "dates"
                          ? dateLabel(r.date)
                          : tab === "businesses"
                            ? r.address
                            : `Position ${r.sort + 1}`}
                    </small>
                    {tab === "offers" && (
                      <CategoryPills
                        ids={r.categories}
                        categories={data.categories}
                      />
                    )}
                  </div>
                  {tab === "offers" && <OfferCampaignStatus offer={r} />}
                  <span
                    className={
                      "status " +
                      (r.status || (r.active ? "published" : "archived"))
                    }
                  >
                    {r.status || (r.active ? "active" : "inactive")}
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`Edit ${r.name || r.title || r.label}`}
                    onClick={() => edit(r)}
                  >
                    <Icon name="edit" />
                  </button>
                  {tab === "offers" && (
                    <button
                      className="icon-button"
                      aria-label={`Duplicate ${r.title}`}
                      onClick={() => {
                        const copy = structuredClone(r);
                        delete copy.id;
                        delete copy.version;
                        delete copy.updated_at;
                        delete copy.updated_by;
                        copy.status = "draft";
                        copy.title += " (copy)";
                        edit(copy);
                      }}
                    >
                      <Icon name="copy" />
                    </button>
                  )}
                </div>
              ),
            )}
            {!list.length && tab !== "submissions" && (
              <div className="empty-state">
                <Icon name="plus" size={36} />
                <h2>{q ? "No matches" : "Start something good."}</h2>
                <p>
                  {q
                    ? "Try another search."
                    : `Add your first ${tab === "businesses" ? "business" : tab === "categories" ? "category" : tab === "dates" ? "campaign date" : "offer"} to get the next evening ready.`}
                </p>
              </div>
            )}
          </div>
          <p className="admin-tip">
            Published offers also need a published business and an applicable
            published campaign to appear on the website.
          </p>
        </main>
      </div>
      {usersOpen && <AdminUsers onClose={() => setUsersOpen(false)} />}
      {confirmClose && (
        <Dialog label="Discard changes?" onClose={() => setConfirmClose(false)}>
          <div className="detail-body">
            <h2>Discard unsaved changes?</h2>
            <p>Your last saved version will be kept.</p>
            <div className="editor-actions">
              <button
                className="button secondary"
                onClick={() => setConfirmClose(false)}
              >
                Keep editing
              </button>
              <button
                className="button primary"
                onClick={() => {
                  setConfirmClose(false);
                  setEditing(null);
                  setDirty(false);
                  setError("");
                }}
              >
                Discard changes
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {editing && (
        <Dialog label={`Edit ${tab}`} onClose={closeEditor} wide>
          <ValidationContext.Provider value={validationIssues}>
          <form ref={editorForm}
            className={`editor ${["businesses", "offers"].includes(tab) ? "editor-tabbed" : ""}`}
            noValidate
            onSubmit={save}
            onInput={(e) => {
              const form = e.currentTarget;
              if (validationAttempted.current) requestAnimationFrame(() => collectIssues(form));
            }}
            onInvalid={(e) => {
              const panel = e.target.closest("[data-editor-tab]");
              if (panel) setEditorTab(panel.dataset.editorTab);
            }}
          >
            <header className="editor-header">
              <h2>
                {editing.name ||
                  editing.title ||
                  editing.label ||
                  "Something good starts here."}
              </h2>
              {["businesses", "offers"].includes(tab) && (
                <div className="editor-toolbar">
                  <div
                    className="admin-editor-tabs"
                    role="tablist"
                    aria-label="Editor sections"
                  >
                    {(tab === "businesses"
                      ? [
                          ["details", "Details"],
                          ["location", "Location"],
                          ["contact", "Contact"],
                          ["photo", "Photo"],
                        ]
                      : [
                          ["details", "Offer"],
                          ["schedule", "Campaigns & hours"],
                          ["terms", "Redemption & terms"],
                          ["photo", "Photo"],
                        ]
                    ).map(([id, label]) => (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={editorTab === id}
                        key={id}
                        onClick={() => setEditorTab(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="editor-header-actions">
                    <button className="button primary" disabled={busy}>
                      <Icon name="save" />
                      {busy ? "Saving…" : "Save"}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={closeEditor}
                    >
                      <Icon name="close" />
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </header>
            {(error || validationIssues.length > 0) && (
              <div className="editor-validation-summary" role="alert">
                <strong>{error ? "Could not save changes" : "Please check the highlighted fields"}</strong>
                {error && <p>{error}</p>}
                {validationIssues.length > 0 && <ul>{validationIssues.map((issue) => (
                  <li key={issue.id}><button type="button" onClick={() => focusIssue(issue)}>{issue.message}</button></li>
                ))}</ul>}
              </div>
            )}
            <div className="editor-content">
              {tab === "businesses" && (
                <>
                  <section
                    className="business-two-columns"
                    data-editor-tab="details"
                    hidden={editorTab !== "details"}
                  >
                    <div>
                      <Field label="Business name">
                        <input
                          value={editing.name}
                          onChange={(e) => update("name", e.target.value)}
                          maxLength={120}
                          required
                        />
                      </Field>
                      {publicationStatus}
                    </div>
                    <Field label="About the business">
                      <textarea
                        value={editing.description}
                        onChange={(e) => update("description", e.target.value)}
                        maxLength={3000}
                        rows={3}
                      />
                    </Field>
                  </section>
                  <section
                    className="business-two-columns"
                    data-editor-tab="location"
                    hidden={editorTab !== "location"}
                  >
                    <div>
                      <Field label="Address">
                        <input
                          value={editing.address}
                          onChange={(e) => update("address", e.target.value)}
                          required={editing.status === "published"}
                        />
                      </Field>
                      <div className="form-grid">
                        <Field label="Latitude">
                          <input
                            type="number"
                            step="any"
                            min="-90"
                            max="90"
                            value={editing.lat ?? ""}
                            onChange={(e) =>
                              update(
                                "lat",
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                          />
                        </Field>
                        <Field label="Longitude">
                          <input
                            type="number"
                            step="any"
                            min="-180"
                            max="180"
                            value={editing.lng ?? ""}
                            onChange={(e) =>
                              update(
                                "lng",
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                          />
                        </Field>
                      </div>
                      <p className="field-hint">
                        Click the map or drag the pin to place this business.
                        Check the entrance location before publishing.
                      </p>
                    </div>
                    <Suspense fallback={<p>Loading map…</p>}>
                      <MapView
                        picker
                        config={config}
                        businesses={[
                          {
                            ...editing,
                            id: editing.id || "new",
                            lat: editing.lat ?? 50.1541,
                            lng: editing.lng ?? -5.0678,
                          },
                        ]}
                        offers={[]}
                        categories={[]}
                        onPick={(p) => {
                          update("lat", Number(p.lat.toFixed(6)));
                          update("lng", Number(p.lng.toFixed(6)));
                        }}
                      />
                    </Suspense>
                  </section>
                  <section
                    data-editor-tab="contact"
                    hidden={editorTab !== "contact"}
                  >
                    <div className="form-grid">
                      <Field label="Website">
                        <input
                          type="url"
                          placeholder="https://"
                          value={editing.website}
                          onChange={(e) => update("website", e.target.value)}
                        />
                      </Field>
                      <Field label="Booking link">
                        <input
                          type="url"
                          placeholder="https://"
                          value={editing.booking}
                          onChange={(e) => update("booking", e.target.value)}
                        />
                      </Field>
                      <Field label="Facebook">
                        <input
                          type="url"
                          placeholder="https://www.facebook.com/yourbusiness"
                          value={editing.facebook || ""}
                          onChange={(e) => update("facebook", e.target.value)}
                        />
                      </Field>
                      <Field label="Instagram">
                        <input
                          type="url"
                          placeholder="https://www.instagram.com/yourbusiness"
                          value={editing.instagram || ""}
                          onChange={(e) => update("instagram", e.target.value)}
                        />
                      </Field>
                      <Field label="Phone">
                        <input
                          type="tel"
                          value={editing.phone}
                          onChange={(e) => update("phone", e.target.value)}
                        />
                      </Field>
                    </div>
                  </section>
                </>
              )}
              {tab === "offers" && (
                <>
                  <section
                    className="offer-two-columns"
                    data-editor-tab="details"
                    hidden={editorTab !== "details"}
                  >
                    <div>
                      <Field label="Business">
                        <AdminSelect
                          required
                          value={editing.business_id}
                          onChange={(e) =>
                            update("business_id", e.target.value)
                          }
                        >
                          <option value="">Choose a business</option>
                          {data.businesses.map((b) => (
                            <option value={b.id} key={b.id}>
                              {b.name}
                              {b.status !== "published" ? ` (${b.status})` : ""}
                            </option>
                          ))}
                        </AdminSelect>
                      </Field>
                      <Field label="Offer title">
                        <input
                          required
                          maxLength={160}
                          value={editing.title}
                          onChange={(e) => update("title", e.target.value)}
                          placeholder="e.g. Two cocktails for £10"
                        />
                      </Field>
                      {publicationStatus}
                    </div>
                    <div>
                      <Field label="Description">
                        <textarea
                          rows={3}
                          maxLength={3000}
                          value={editing.description}
                          onChange={(e) =>
                            update("description", e.target.value)
                          }
                        />
                      </Field>
                      <fieldset>
                        <legend>
                          Categories <small>Select all that apply</small>
                        </legend>
                        <div className="checkbox-grid">
                          {data.categories
                            .filter(
                              (c) =>
                                c.active || editing.categories.includes(c.id),
                            )
                            .map((c) => (
                              <label key={c.id}>
                                <input
                                  type="checkbox"
                                  checked={editing.categories.includes(c.id)}
                                  onChange={(e) =>
                                    update(
                                      "categories",
                                      e.target.checked
                                        ? [...editing.categories, c.id]
                                        : editing.categories.filter(
                                            (v) => v !== c.id,
                                          ),
                                    )
                                  }
                                />
                                <Icon name={c.icon} />
                                {c.name}
                                {!c.active ? " (inactive)" : ""}
                              </label>
                            ))}
                        </div>
                      </fieldset>
                    </div>
                  </section>
                  <section
                    className="offer-two-columns"
                    data-editor-tab="schedule"
                    hidden={editorTab !== "schedule"}
                  >
                    <div>
                      <p className="notice">
                        {editing.schedule_mode === "all"
                          ? "No dates set — this offer appears on all published campaigns, including new campaigns added later."
                          : "Choose the campaigns this offer should appear on. Dates are managed in Campaigns."}
                      </p>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editing.schedule_mode === "specific"}
                          onChange={(e) =>
                            update(
                              "schedule_mode",
                              e.target.checked ? "specific" : "all",
                            )
                          }
                        />
                        Set specific campaigns
                      </label>
                      {editing.schedule_mode === "specific" && (
                        <fieldset className="campaign-selection">
                          <legend>Campaigns</legend>
                          <Field label="Find a campaign">
                            <AdminSelect
                              value=""
                              onChange={(e) =>
                                update("campaign_ids", [
                                  ...editing.campaign_ids,
                                  e.target.value,
                                ])
                              }
                            >
                              <option value="">
                                Search or choose a campaign
                              </option>
                              {[...data.dates]
                                .sort((a, b) => a.date.localeCompare(b.date))
                                .filter(
                                  (d) => !editing.campaign_ids.includes(d.id),
                                )
                                .map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {campaignLabel(d)} ·{" "}
                                    {dateLabel(d.date, true)}
                                    {d.status !== "published"
                                      ? ` (${d.status})`
                                      : ""}
                                  </option>
                                ))}
                            </AdminSelect>
                          </Field>
                          <div className="selected-campaigns">
                            {editing.campaign_ids.map((id) => {
                              const d = data.dates.find((d) => d.id === id);
                              return (
                                <div key={id}>
                                  <span>
                                    {campaignLabel(d)} ·{" "}
                                    {d
                                      ? dateLabel(d.date, true)
                                      : "Unavailable"}
                                  </span>
                                  <button
                                    type="button"
                                    className="icon-button"
                                    aria-label={`Remove ${campaignLabel(d)}`}
                                    onClick={() =>
                                      update(
                                        "campaign_ids",
                                        editing.campaign_ids.filter(
                                          (v) => v !== id,
                                        ),
                                      )
                                    }
                                  >
                                    <Icon name="close" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          {!editing.campaign_ids.length && (
                            <p className="field-hint">
                              Select at least one campaign, or untick “Set
                              specific campaigns”.
                            </p>
                          )}
                          {!data.dates.length && (
                            <p className="field-hint">
                              Create campaigns in the Campaigns section first.
                            </p>
                          )}
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={editing.roll_over}
                              onChange={(e) =>
                                update("roll_over", e.target.checked)
                              }
                            />
                            Roll-over onto future campaigns
                          </label>
                          <p className="field-hint">
                            After the last selected campaign, this offer will
                            also appear on later published campaigns. It will
                            not fill gaps between your selected campaigns.
                          </p>
                        </fieldset>
                      )}
                    </div>
                    <div>
                      <fieldset>
                        <legend>
                          Offer hours{" "}
                          <small>UK time on each campaign date</small>
                        </legend>
                        <div className="form-grid">
                          <Field label="Starts">
                            <input
                              type="time"
                              required
                              value={editing.start_time}
                              onChange={(e) =>
                                update("start_time", e.target.value)
                              }
                            />
                          </Field>
                          <Field label="Ends">
                            <input
                              type="time"
                              required
                              value={editing.end_time}
                              onChange={(e) =>
                                update("end_time", e.target.value)
                              }
                            />
                          </Field>
                        </div>
                        <p className="field-hint">
                          An end time earlier than the start means the following
                          morning. These hours apply to every selected or
                          rolled-over campaign.
                        </p>
                      </fieldset>
                      <Field label="Displayed hours note (optional)">
                        <input
                          value={editing.time_note || ""}
                          maxLength={200}
                          onChange={(e) => update("time_note", e.target.value)}
                          placeholder="e.g. Lunch & dinner · check service times"
                        />
                        <p className="field-hint">
                          Replaces the public time label. Scheduled start and
                          end times still control visibility.
                        </p>
                      </Field>
                    </div>
                  </section>
                  <section
                    className="offer-two-columns"
                    data-editor-tab="terms"
                    hidden={editorTab !== "terms"}
                  >
                    <Field label="How to redeem or book">
                      <textarea
                        rows={2}
                        value={editing.redemption}
                        onChange={(e) => update("redemption", e.target.value)}
                        placeholder="e.g. Quote Falmouth After Five when booking"
                      />
                    </Field>
                    <Field label="Terms & conditions">
                      <textarea
                        rows={3}
                        value={editing.terms}
                        onChange={(e) => update("terms", e.target.value)}
                        placeholder="Include exclusions, age restrictions and availability where relevant."
                      />
                    </Field>
                  </section>
                </>
              )}
              {tab === "dates" && (
                <>
                  <Field
                    label="Find the first Friday"
                    hint="Choose a month to fill the date. You can change it to another day below."
                  >
                    <input
                      type="month"
                      onChange={(e) => {
                        if (e.target.value) {
                          update("date", firstFriday(e.target.value));
                          if (!editing.label)
                            update(
                              "label",
                              new Intl.DateTimeFormat("en-GB", {
                                month: "long",
                                year: "numeric",
                              }).format(
                                new Date(e.target.value + "-01T12:00:00"),
                              ),
                            );
                        }
                      }}
                    />
                  </Field>
                  <Field label="Campaign date">
                    <input
                      type="date"
                      required
                      value={editing.date}
                      onChange={(e) => update("date", e.target.value)}
                    />
                  </Field>
                  <Field label="Display label">
                    <input
                      required
                      value={editing.label}
                      onChange={(e) => update("label", e.target.value)}
                      maxLength={100}
                    />
                  </Field>
                </>
              )}
              {tab === "categories" && (
                <>
                  <Field label="Category name">
                    <input
                      required
                      maxLength={40}
                      value={editing.name}
                      onChange={(e) => update("name", e.target.value)}
                    />
                  </Field>
                  <Field label="Icon">
                    <AdminSelect
                      value={editing.icon}
                      onChange={(e) => update("icon", e.target.value)}
                    >
                      {[
                        "drinks",
                        "food",
                        "shopping",
                        "entertainment",
                        "experiences",
                        "wellbeing",
                        "stay",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </AdminSelect>
                  </Field>
                  <fieldset>
                    <legend>Category colour</legend>
                    <div className="colour-choices">
                      {palette.map((c) => (
                        <label key={c} style={{ background: c }}>
                          <input
                            type="radio"
                            name="colour"
                            aria-label={`Colour ${c}`}
                            checked={editing.colour === c}
                            onChange={() => update("colour", c)}
                          />
                          {editing.colour === c && <Icon name="check" />}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <Field label="Custom hex colour">
                    <input
                      value={editing.colour}
                      pattern="#[0-9a-fA-F]{6}"
                      placeholder="#1269b0"
                      onChange={(e) => update("colour", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Custom SVG icon"
                    hint="SVG only, up to 100 KB. Simple vector shapes; scripts and external resources are rejected."
                  >
                    <input
                      type="file"
                      accept=".svg,image/svg+xml"
                      disabled={busy}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setBusy(true);
                        try {
                          const f = new FormData();
                          f.set("image", file);
                          const r = await api("upload-icon", f);
                          update("icon", r.path);
                        } catch (e) {
                          setError(e.message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  </Field>
                  {editing.icon.startsWith("uploads/") && (
                    <p>
                      <Icon name={editing.icon} size={32} /> Custom icon
                      selected. Choose a built-in icon above to replace it.
                    </p>
                  )}
                  <Field label="Display position (0 first)">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editing.sort}
                      onChange={(e) => update("sort", Number(e.target.value))}
                    />
                  </Field>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={editing.active}
                      onChange={(e) => update("active", e.target.checked)}
                    />
                    Active category
                  </label>
                </>
              )}
              {["businesses", "offers"].includes(tab) && (
                <fieldset
                  data-editor-tab="photo"
                  hidden={editorTab !== "photo"}
                >
                  <legend>
                    Photo{" "}
                    <small>
                      {tab === "offers"
                        ? "Optional; uses the business photo when empty."
                        : "Optional"}
                    </small>
                  </legend>
                  <div className="photo-editor-columns">
                    <PhotoDropzone onUpload={upload} busy={busy} />
                    <div>
                      {editing.image && (
                        <div className="upload-preview">
                          <img
                            src={"./" + editing.image}
                            alt={editing.image_alt || "Selected image preview"}
                          />
                          <button
                            className="text-link"
                            type="button"
                            onClick={() => {
                              update("image", "");
                              update("image_alt", "");
                            }}
                          >
                            Remove photo
                          </button>
                        </div>
                      )}
                      {editing.image && (
                        <Field
                          label="Image description"
                          hint="Required when a photo is added. Describe what is visible for people using a screen reader."
                        >
                          <input
                            required
                            maxLength={200}
                            value={editing.image_alt}
                            onChange={(e) =>
                              update("image_alt", e.target.value)
                            }
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                </fieldset>
              )}
              {tab === "dates" && publicationStatus}
              <div
                className="editor-actions"
                hidden={["businesses", "offers"].includes(tab)}
              >
                {!["businesses", "offers"].includes(tab) && (
                  <button className="button primary" disabled={busy}>
                    <Icon name="save" />
                    {busy ? "Saving…" : "Save changes"}
                  </button>
                )}
                {!["businesses", "offers"].includes(tab) && (
                  <button
                    className="text-link"
                    type="button"
                    onClick={closeEditor}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>
          </ValidationContext.Provider>
        </Dialog>
      )}
      {account && (
        <Dialog label="Account settings" onClose={() => setAccount(false)}>
          <form
            className="editor"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              setBusy(true);
              setError("");
              try {
                await api("password", Object.fromEntries(new FormData(form)));
                setAccount(false);
                setMessage(
                  "Password changed. Other sessions have been signed out.",
                );
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>Your account</h2>
            <p>{session.user.email}</p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Field label="Current password">
              <input
                type="password"
                name="current"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="New password (12+ characters)">
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={200}
              />
            </Field>
            <button className="button primary" disabled={busy}>
              Change password
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
