import React, { useEffect, useState, Suspense, lazy } from "react";
import { api } from "./api";
import Icon from "./icons";
import { Dialog, OfferDetail, CategoryPills } from "./main";
import { firstFriday, dateLabel } from "./domain";
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
  dates: "Campaign dates",
  categories: "Categories",
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
    categories: [],
    occurrences: [],
    image: "",
    image_alt: "",
    status: "draft",
  },
  dates: { date: "", label: "First Friday", status: "draft" },
  categories: {
    name: "",
    colour: palette[0],
    icon: "drinks",
    sort: 5,
    active: true,
  },
};
function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export default function Admin() {
  const [session, setSession] = useState(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [data, setData] = useState(null),
    [config, setConfig] = useState(null),
    [tab, setTab] = useState("offers"),
    [editing, setEditing] = useState(null),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [q, setQ] = useState(""),
    [account, setAccount] = useState(false),
    [dirty, setDirty] = useState(false);
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
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setEditing(null);
    setDirty(false);
    setError("");
  };
  const update = (key, value) => {
    setEditing((v) => ({ ...v, [key]: value }));
    setDirty(true);
  };
  const edit = (r) => {
    setEditing(structuredClone(r));
    setDirty(false);
    setError("");
    setMessage("");
  };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("save", { kind: tab, record: editing });
      await load();
      setEditing(null);
      setDirty(false);
      setMessage(
        editing.status === "published"
          ? "Saved as published. The business and campaign date must also be published for offers to appear."
          : "Changes saved.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
  if (!ready) return <div className="page-loading">Opening staff area…</div>;
  if (!session?.user)
    return (
      <main className="login-page">
        <a href="./">
          <img src="./assets/logo.png" alt="Falmouth After Five" />
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
      `${r.name || r.title || r.label} ${r.address || ""}`
        .toLowerCase()
        .includes(q.toLowerCase()),
    ) || [];
  const business = data?.businesses.find((b) => b.id === editing?.business_id);
  return (
    <div className="admin-app">
      {session.demo && (
        <div className="demo-banner">
          Demo workspace · Changes here do not affect the live campaign
          database.
        </div>
      )}
      <header className="admin-header">
        <a href="./">
          <img src="./assets/logo.png" alt="Falmouth After Five" />
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
          </div>
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
            {list.map((r) => (
              <div className="admin-record" key={r.id}>
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
                      copy.occurrences = [];
                      copy.title += " (copy)";
                      edit(copy);
                    }}
                  >
                    <Icon name="copy" />
                  </button>
                )}
              </div>
            ))}
            {!list.length && (
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
            Published offers also need a published business and campaign date to
            appear on the website.
          </p>
        </main>
      </div>
      {editing && (
        <Dialog label={`Edit ${tab}`} onClose={closeEditor} wide>
          <form className="editor" onSubmit={save}>
            <p className="eyebrow">
              {editing.id ? "EDIT" : "CREATE"}{" "}
              {tab === "businesses"
                ? "BUSINESS"
                : tab === "categories"
                  ? "CATEGORY"
                  : tab === "dates"
                    ? "CAMPAIGN DATE"
                    : "OFFER"}
            </p>
            <h2>
              {editing.name ||
                editing.title ||
                editing.label ||
                "Something good starts here."}
            </h2>
            {editing.updated_at && (
              <p className="edit-meta">
                Last saved by {editing.updated_by} ·{" "}
                {new Date(editing.updated_at).toLocaleString("en-GB")}
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {tab === "businesses" && (
              <>
                <Field label="Business name">
                  <input
                    value={editing.name}
                    onChange={(e) => update("name", e.target.value)}
                    maxLength={120}
                    required
                  />
                </Field>
                <Field label="About the business">
                  <textarea
                    value={editing.description}
                    onChange={(e) => update("description", e.target.value)}
                    maxLength={3000}
                    rows={3}
                  />
                </Field>
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
                          e.target.value === "" ? null : Number(e.target.value),
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
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                </div>
                <p className="field-hint">
                  Click the map or drag the pin to place this business. Check
                  the entrance location before publishing.
                </p>
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
                </div>
                <Field label="Phone">
                  <input
                    type="tel"
                    value={editing.phone}
                    onChange={(e) => update("phone", e.target.value)}
                  />
                </Field>
              </>
            )}
            {tab === "offers" && (
              <>
                <Field label="Business">
                  <select
                    required
                    value={editing.business_id}
                    onChange={(e) => update("business_id", e.target.value)}
                  >
                    <option value="">Choose a business</option>
                    {data.businesses.map((b) => (
                      <option value={b.id} key={b.id}>
                        {b.name}
                        {b.status !== "published" ? ` (${b.status})` : ""}
                      </option>
                    ))}
                  </select>
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
                <Field label="Description">
                  <textarea
                    rows={3}
                    maxLength={3000}
                    value={editing.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </Field>
                <fieldset>
                  <legend>
                    Categories <small>Select all that apply</small>
                  </legend>
                  <div className="checkbox-grid">
                    {data.categories
                      .filter(
                        (c) => c.active || editing.categories.includes(c.id),
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
                <fieldset>
                  <legend>
                    Dates & times{" "}
                    <small>UK time, including daylight saving</small>
                  </legend>
                  {editing.occurrences.map((o, i) => (
                    <div className="occurrence" key={i}>
                      <Field label="Campaign date">
                        <select
                          required
                          value={o.date_id}
                          onChange={(e) => {
                            const d = data.dates.find(
                              (d) => d.id === e.target.value,
                            );
                            update(
                              "occurrences",
                              editing.occurrences.map((v, j) =>
                                j === i
                                  ? {
                                      date_id: d.id,
                                      start: d.date + "T17:00",
                                      end: d.date + "T21:00",
                                    }
                                  : v,
                              ),
                            );
                          }}
                        >
                          <option value="" disabled>
                            Choose date
                          </option>
                          {data.dates.map((d) => (
                            <option value={d.id} key={d.id}>
                              {dateLabel(d.date, true)}
                              {d.status !== "published" ? ` (${d.status})` : ""}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="form-grid">
                        <Field label="Starts">
                          <input
                            type="datetime-local"
                            required
                            value={o.start}
                            onChange={(e) =>
                              update(
                                "occurrences",
                                editing.occurrences.map((v, j) =>
                                  j === i ? { ...v, start: e.target.value } : v,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Ends">
                          <input
                            type="datetime-local"
                            required
                            value={o.end}
                            onChange={(e) =>
                              update(
                                "occurrences",
                                editing.occurrences.map((v, j) =>
                                  j === i ? { ...v, end: e.target.value } : v,
                                ),
                              )
                            }
                          />
                        </Field>
                      </div>
                      <button
                        className="text-link"
                        type="button"
                        onClick={() =>
                          update(
                            "occurrences",
                            editing.occurrences.filter((_, j) => j !== i),
                          )
                        }
                      >
                        Remove date
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="button secondary small"
                    disabled={!data.dates.length}
                    onClick={() => {
                      const d =
                        [...data.dates]
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .find(
                            (d) =>
                              d.date >= new Date().toISOString().slice(0, 10),
                          ) || data.dates[0];
                      update("occurrences", [
                        ...editing.occurrences,
                        {
                          date_id: d.id,
                          start: d.date + "T17:00",
                          end: d.date + "T21:00",
                        },
                      ]);
                    }}
                  >
                    <Icon name="plus" />
                    Add a date
                  </button>
                  {!data.dates.length && (
                    <p className="field-hint">
                      Create a campaign date first. You can save this offer as a
                      draft.
                    </p>
                  )}
                </fieldset>
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
                      if (e.target.value)
                        update("date", firstFriday(e.target.value));
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
                  <select
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
                  </select>
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
              <fieldset>
                <legend>
                  Photo{" "}
                  <small>
                    {tab === "offers"
                      ? "Optional; uses the business photo when empty."
                      : "Optional"}
                  </small>
                </legend>
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
                <Field
                  label="Upload image"
                  hint="JPG, PNG or WebP. Maximum 8 MB."
                >
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={upload}
                    disabled={busy}
                  />
                </Field>
                {editing.image && (
                  <Field
                    label="Image description"
                    hint="Describe what is visible for people using a screen reader."
                  >
                    <input
                      required
                      maxLength={200}
                      value={editing.image_alt}
                      onChange={(e) => update("image_alt", e.target.value)}
                    />
                  </Field>
                )}
              </fieldset>
            )}
            {tab !== "categories" && (
              <Field label="Publication status">
                <select
                  value={editing.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  <option value="draft">Draft · staff only</option>
                  <option value="published">
                    Published · visible when its date and business are published
                  </option>
                  <option value="archived">
                    Archived · hidden from visitors
                  </option>
                </select>
              </Field>
            )}
            <div className="editor-actions">
              <button className="button primary" disabled={busy}>
                <Icon name="save" />
                {busy ? "Saving…" : "Save changes"}
              </button>
              {["offers", "businesses"].includes(tab) && (
                <button
                  className="button secondary"
                  type="button"
                  disabled={tab === "offers" && !business}
                  onClick={() => setPreview(true)}
                >
                  <Icon name="eye" />
                  Preview
                </button>
              )}
              <button className="text-link" type="button" onClick={closeEditor}>
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {preview && editing && (
        <Dialog label="Content preview" onClose={() => setPreview(false)}>
          {tab === "offers" ? (
            <OfferDetail
              preview
              offer={editing}
              business={business}
              categories={data.categories}
            />
          ) : (
            <div className="detail-body">
              <p className="notice">
                Business preview. This does not publish your changes.
              </p>
              {editing.image && (
                <img
                  className="detail-image"
                  src={"./" + editing.image}
                  alt={editing.image_alt}
                />
              )}
              <h2>{editing.name}</h2>
              <p>{editing.description}</p>
              <p>
                <Icon name="pin" /> {editing.address}
              </p>
            </div>
          )}
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
