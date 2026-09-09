import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "./style.css";
import Icon from "./icons";
import { api } from "./api";
import {
  availableDates,
  defaultDate,
  matchingOffers,
  dateLabel,
  timeLabel,
} from "./domain";
const MapView = lazy(() =>
  import("./MapView").catch(() => ({
    default: () => (
      <div className="map-shell">
        <div className="map-status">
          <h3>The map could not load</h3>
          <p>
            Every offer is still available in the list. Reload the page to try
            the map again.
          </p>
        </div>
      </div>
    ),
  })),
);
const Admin = lazy(() =>
  import("./Admin").catch(() => ({
    default: () => (
      <div className="page-loading">
        <h1>Please reload the staff area</h1>
        <p>A connection issue or recent update interrupted loading.</p>
        <a className="button primary" href="?admin">
          Reload staff area
        </a>
      </div>
    ),
  })),
);
export function CategoryPills({ ids, categories }) {
  return (
    <div className="category-pills">
      {categories
        .filter((c) => ids.includes(c.id))
        .map((c) => (
          <span key={c.id} style={{ "--cat": c.colour }}>
            <Icon name={c.icon} size={15} />
            {c.name}
          </span>
        ))}
    </div>
  );
}
let openDialogs = 0;
export function Dialog({ children, onClose, label, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const prior = document.activeElement;
    ref.current.showModal();
    openDialogs++;
    document.body.style.overflow = "hidden";
    return () => {
      openDialogs--;
      if (!openDialogs) document.body.style.overflow = "";
      prior?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={wide ? "wide-dialog" : ""}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <button
        className="icon-button dialog-close"
        onClick={onClose}
        aria-label="Close"
      >
        <Icon name="close" />
      </button>
      {children}
    </dialog>
  );
}
export function OfferDetail({
  offer,
  business,
  categories,
  dateId,
  preview = false,
  onClose,
  track = () => {},
}) {
  const dates = offer.occurrences.filter(
    (o) => !dateId || o.date_id === dateId,
  );
  const image = offer.image || business.image;
  return (
    <div className="offer-detail">
      {image && (
        <img
          className="detail-image"
          src={"./" + image}
          alt={offer.image_alt || business.image_alt}
        />
      )}
      <div className="detail-body">
        {preview && (
          <p className="notice">
            Preview only. This does not publish your changes.
          </p>
        )}
        <p className="venue-name">{business.name}</p>
        <h2>{offer.title}</h2>
        <CategoryPills ids={offer.categories} categories={categories} />
        <p className="detail-description">{offer.description}</p>
        <div className="detail-facts">
          {dates.map((o, i) => (
            <div key={i}>
              <Icon name="calendar" />
              <span>
                {dateLabel(o.start.slice(0, 10))}
                <small>
                  {o.start_iso ? timeLabel(o.start_iso) : o.start.slice(11)} –{" "}
                  {o.end_iso ? timeLabel(o.end_iso) : o.end.slice(11)}
                  {o.end.slice(0, 10) !== o.start.slice(0, 10)
                    ? " (next day)"
                    : ""}
                </small>
              </span>
            </div>
          ))}
          <div>
            <Icon name="pin" />
            <span>{business.address}</span>
          </div>
        </div>
        {offer.redemption && (
          <>
            <h3>How to enjoy this offer</h3>
            <p>{offer.redemption}</p>
          </>
        )}
        {offer.terms && (
          <>
            <h3>The details</h3>
            <p className="preserve-lines">{offer.terms}</p>
          </>
        )}
        <div className="detail-actions">
          <a
            className="button primary"
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(business.lat !== null && business.lng !== null ? `${business.lat},${business.lng}` : business.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              track("directions_click", {
                offer_id: offer.id,
                business_id: business.id,
              })
            }
          >
            <Icon name="pin" /> Get directions <Icon name="external" />
          </a>
          {(business.booking || business.website) && (
            <a
              className="button secondary"
              href={business.booking || business.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                track(business.booking ? "booking_click" : "website_click", {
                  offer_id: offer.id,
                  business_id: business.id,
                })
              }
            >
              {business.booking ? "Book with the venue" : "Visit website"}
              <Icon name="external" />
            </a>
          )}
          {business.phone && (
            <a
              className="text-link"
              href={"tel:" + business.phone.replace(/[^+\d]/g, "")}
            >
              <Icon name="phone" />
              {business.phone}
            </a>
          )}
        </div>
        {business.description && (
          <div className="about-venue">
            <h3>About {business.name}</h3>
            <p>{business.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
function App() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [view, setView] = useState("welcome"),
    [date, setDate] = useState(""),
    [search, setSearch] = useState(""),
    [filters, setFilters] = useState([]),
    [selected, setSelected] = useState(null),
    [venues, setVenues] = useState(null),
    [tick, setTick] = useState(Date.now()),
    [privacy, setPrivacy] = useState(false),
    [consent, setConsent] = useState(
      () => localStorage.getItem("faf-analytics") || "",
    );
  const isAdmin = new URLSearchParams(location.search).has("admin");
  const initial = useRef(true),
    clockOffset = useRef(0);
  const load = () =>
    api("public")
      .then((d) => {
        clockOffset.current = new Date(d.now).getTime() - Date.now();
        setData(d);
        setError("");
        if (initial.current) {
          initial.current = false;
          const p = new URLSearchParams(location.search),
            chosen = p.get("date");
          setDate(
            d.dates.some((v) => v.id === chosen)
              ? chosen
              : defaultDate(d, new Date(d.now)),
          );
          if (p.get("offer")) {
            setSelected(p.get("offer"));
            setView("list");
          } else if (p.get("view"))
            setView(p.get("view") === "map" ? "map" : "list");
        }
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (!isAdmin) load();
    const timer = setInterval(() => {
      setTick(Date.now());
      if (!isAdmin) load();
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!data?.config.gaId || consent !== "yes" || isAdmin || data.demo) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments);
      };
    if (!document.getElementById("faf-ga")) {
      const s = document.createElement("script");
      s.id = "faf-ga";
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${data.config.gaId}`;
      document.head.appendChild(s);
      window.gtag("js", new Date());
      window.gtag("config", data.config.gaId, { send_page_view: true });
    }
    window["ga-disable-" + data.config.gaId] = false;
  }, [data?.config.gaId, consent]);
  const track = (event, params = {}) => {
    if (consent === "yes" && data?.config.gaId && !data.demo)
      window.gtag?.("event", event, { ...params, campaign_date: date });
  };
  const chooseConsent = (value) => {
    localStorage.setItem("faf-analytics", value);
    setConsent(value);
    if (data?.config.gaId)
      window["ga-disable-" + data.config.gaId] = value !== "yes";
    setPrivacy(false);
  };
  useEffect(() => {
    if (isAdmin || initial.current) return;
    const url = new URL(location.href);
    url.searchParams.delete("offer");
    url.searchParams.delete("date");
    url.searchParams.delete("view");
    if (selected) url.searchParams.set("offer", selected);
    if (date) url.searchParams.set("date", date);
    if (view !== "welcome") url.searchParams.set("view", view);
    history.replaceState(null, "", url);
  }, [date, selected, view]);
  const now = new Date(tick + clockOffset.current),
    dates = data ? availableDates(data, now) : [],
    matched = data ? matchingOffers(data, date, search, filters, now) : [],
    current = data?.dates.find((d) => d.id === date),
    categories = data
      ? [...data.categories].sort((a, b) => a.sort - b.sort)
      : [];
  const dateOffers = data ? matchingOffers(data, date, "", [], now) : [],
    visibleCats = categories.filter((c) =>
      dateOffers.some((o) => o.categories.includes(c.id)),
    );
  const offer = data?.offers.find((o) => o.id === selected),
    business = data?.businesses.find((b) => b.id === offer?.business_id);
  const enter = (v) => {
    setView(v);
    window.scrollTo(0, 0);
    track("explorer_open", { view: v });
  };
  const selectOffer = (o) => {
    setSelected(o.id);
    setVenues(null);
    track("offer_view", { offer_id: o.id, business_id: o.business_id });
  };
  if (isAdmin)
    return (
      <Suspense
        fallback={<div className="page-loading">Opening staff area…</div>}
      >
        <Admin />
      </Suspense>
    );
  if (!data)
    return (
      <div className="page-loading">
        <img src="./assets/logo.png" alt="Falmouth After Five" />
        <p role="status">{error || "Getting your evening ready…"}</p>
        {error && (
          <button className="button primary" onClick={load}>
            Try again
          </button>
        )}
      </div>
    );
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to offers
      </a>
      {data.demo && (
        <div className="demo-banner">
          Demo preview · Historical examples, sample dates and approximate map
          pins. Offers are not live.
        </div>
      )}
      <header className="site-header">
        <button
          className="brand-button"
          onClick={() => setView("welcome")}
          aria-label="Falmouth After Five home"
        >
          <img src="./assets/logo.png" alt="Falmouth After Five" />
        </button>
        <div className="header-right">
          <a
            href="https://www.falmouth.co.uk/discover-falmouth/falmouth-after-5/"
            className="campaign-link"
          >
            About First Fridays <Icon name="external" size={17} />
          </a>
          {view !== "welcome" && (
            <button
              className="button small secondary"
              onClick={() => setView("welcome")}
            >
              About the evening
            </button>
          )}
          <span className="bid-label">A Falmouth BID initiative</span>
        </div>
      </header>
      <main id="main">
        {view === "welcome" ? (
          <section className="welcome">
            <div className="welcome-copy">
              <p className="eyebrow">
                <span className="rainbow-line" /> FIRST FRIDAYS IN FALMOUTH
              </p>
              <h1>
                Make an
                <br />
                evening <span>of it.</span>
              </h1>
              <p className="welcome-intro">
                Good food. A drink with friends. Something a little different.
                Find your Friday in Falmouth.
              </p>
              <div className="welcome-actions">
                <button
                  className="button primary"
                  onClick={() => enter("list")}
                >
                  Browse the offers <Icon name="right" />
                </button>
                <button
                  className="button secondary"
                  onClick={() => enter("map")}
                >
                  <Icon name="map" /> Explore the map
                </button>
              </div>
              <div className="next-date">
                <Icon name="calendar" size={25} />
                <div>
                  <small>
                    {current ? "YOUR NEXT EVENING OUT" : "WATCH THIS SPACE"}
                  </small>
                  <strong>
                    {current
                      ? dateLabel(current.date)
                      : "Next date to be announced"}
                  </strong>
                </div>
              </div>
            </div>
            <div
              className="welcome-art"
              aria-label="Food, drinks and a little more Falmouth"
            >
              <div className="art-top">THE TOWN IS YOURS.</div>
              <div className="giant-five" aria-hidden="true">
                5<span>PM & ONWARDS</span>
              </div>
              <div className="art-stickers" aria-hidden="true">
                <span className="sticker drinks">
                  <Icon name="drinks" size={35} />
                </span>
                <span className="sticker food">
                  <Icon name="food" size={35} />
                </span>
                <span className="sticker entertainment">
                  <Icon name="entertainment" size={35} />
                </span>
              </div>
              <p>Stay a little longer.</p>
              <div className="art-rainbow">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="welcome-foot">
              <span>Local favourites. Lovely discoveries.</span>
              <div>
                {categories.map((c) => (
                  <span key={c.id}>
                    <Icon name={c.icon} size={19} />
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="explorer">
            <div className="explorer-heading">
              <div>
                <p className="eyebrow">YOUR FRIDAY, YOUR WAY</p>
                <h1>A little more Falmouth.</h1>
              </div>
              <label className="date-select">
                <Icon name="calendar" />
                <span className="sr-only">Campaign date</span>
                <select
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setFilters([]);
                  }}
                >
                  {!dates.length && (
                    <option value="">Next date to be announced</option>
                  )}
                  {current && !dates.some((d) => d.id === current.id) && (
                    <option value={current.id}>
                      {dateLabel(current.date, true)} (ended)
                    </option>
                  )}
                  {dates.map((d) => (
                    <option value={d.id} key={d.id}>
                      {dateLabel(d.date)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="explorer-toolbar">
              <label className="search-field">
                <Icon name="search" />
                <span className="sr-only">Search businesses and offers</span>
                <input
                  aria-label="Search businesses and offers"
                  placeholder="Find a place, a plate, a plan…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <Icon name="close" size={17} />
                  </button>
                )}
              </label>
              <div className="view-switch" aria-label="View options">
                <button
                  className={view === "list" ? "active" : ""}
                  aria-pressed={view === "list"}
                  onClick={() => {
                    setView("list");
                    track("view_change", { view: "list" });
                  }}
                >
                  <Icon name="list" />
                  List
                </button>
                <button
                  className={view === "map" ? "active" : ""}
                  aria-pressed={view === "map"}
                  onClick={() => {
                    setView("map");
                    track("view_change", { view: "map" });
                  }}
                >
                  <Icon name="map" />
                  Map
                </button>
              </div>
            </div>
            <div className="filter-bar">
              <button
                className={"filter all " + (!filters.length ? "selected" : "")}
                aria-pressed={!filters.length}
                onClick={() => setFilters([])}
              >
                All offers
              </button>
              {visibleCats.map((c) => (
                <button
                  key={c.id}
                  className={
                    "filter " + (filters.includes(c.id) ? "selected" : "")
                  }
                  style={{ "--cat": c.colour }}
                  aria-pressed={filters.includes(c.id)}
                  onClick={() => {
                    setFilters((v) =>
                      v.includes(c.id)
                        ? v.filter((x) => x !== c.id)
                        : [...v, c.id],
                    );
                    track("category_filter", { category_id: c.id });
                  }}
                >
                  <Icon name={c.icon} size={18} />
                  {c.name}
                  {filters.includes(c.id) && <Icon name="check" size={15} />}
                </button>
              ))}
            </div>
            {error && (
              <p className="notice" role="status">
                Couldn’t refresh offers. Showing the last loaded information.{" "}
                <button onClick={load}>Try again</button>
              </p>
            )}
            <div className="results-caption">
              <p role="status">
                <strong>{matched.length}</strong>{" "}
                {matched.length === 1 ? "offer" : "offers"}
                {current ? ` for ${dateLabel(current.date, true)}` : ""}
              </p>
              {(filters.length > 0 || search) && (
                <button
                  className="text-link"
                  onClick={() => {
                    setFilters([]);
                    setSearch("");
                  }}
                >
                  Clear filters <Icon name="close" size={14} />
                </button>
              )}
              <span>Find your kind of evening</span>
            </div>
            <div
              className={"results-layout " + (view === "map" ? "with-map" : "")}
            >
              <div className="offers-grid">
                {matched.map((o) => {
                  const b = data.businesses.find((b) => b.id === o.business_id),
                    occ = o.occurrences.find((v) => v.date_id === date);
                  return (
                    <button
                      className="offer-card"
                      key={o.id}
                      onClick={() => selectOffer(o)}
                    >
                      {o.image || b.image ? (
                        <img
                          src={"./" + (o.image || b.image)}
                          alt={o.image_alt || b.image_alt}
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="offer-art"
                          style={{
                            "--cat":
                              categories.find((c) =>
                                o.categories.includes(c.id),
                              )?.colour || "#004b91",
                          }}
                        >
                          <span className="offer-art-name">{b.name}</span>
                          <Icon
                            name={
                              categories.find((c) =>
                                o.categories.includes(c.id),
                              )?.icon
                            }
                            size={60}
                          />
                        </div>
                      )}
                      <div className="offer-card-body">
                        <CategoryPills
                          ids={o.categories}
                          categories={categories}
                        />
                        <p className="venue-name">{b.name}</p>
                        <h2>{o.title}</h2>
                        <div className="card-bottom">
                          <span>
                            <Icon name="clock" size={16} />
                            {timeLabel(occ.start_iso)} –{" "}
                            {timeLabel(occ.end_iso)}
                          </span>
                          <span className="card-arrow">
                            <Icon name="right" />
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {!matched.length && (
                  <div className="empty-state">
                    <Icon name="compass" size={42} />
                    <h2>
                      {!date
                        ? "Good things are on the way."
                        : "No offers found just yet."}
                    </h2>
                    <p>
                      {!date
                        ? "The next First Friday will appear here once it’s announced."
                        : "Try another date or clear your filters to find something lovely."}
                    </p>
                    {(filters.length > 0 || search) && (
                      <button
                        className="button secondary"
                        onClick={() => {
                          setFilters([]);
                          setSearch("");
                        }}
                      >
                        Show all offers
                      </button>
                    )}
                  </div>
                )}
              </div>
              {view === "map" && (
                <div className="map-column">
                  <Suspense
                    fallback={
                      <div className="map-status">Opening the map…</div>
                    }
                  >
                    <MapView
                      config={data.config}
                      businesses={data.businesses}
                      offers={matched}
                      categories={categories.filter(
                        (c) => !filters.length || filters.includes(c.id),
                      )}
                      onSelect={setVenues}
                    />
                  </Suspense>
                  <p className="map-hint">
                    <Icon name="pin" size={15} /> Pick a pin to see what’s on
                    offer. Colours match the categories.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span>Made for evenings in Falmouth.</span>
        <div>
          <a href="https://www.falmouth.co.uk/">
            Falmouth BID <Icon name="external" size={14} />
          </a>
          <button onClick={() => setPrivacy(true)}>Privacy & cookies</button>
          <a href="?admin">Staff login</a>
        </div>
      </footer>
      {selected && (
        <Dialog
          label={offer?.title || "Offer unavailable"}
          onClose={() => setSelected(null)}
        >
          {offer && business ? (
            <>
              {offer.occurrences.every((o) => new Date(o.end_iso) <= now) && (
                <p className="notice">
                  This offer has ended. Browse the latest campaign date for
                  current offers.
                </p>
              )}
              <OfferDetail
                offer={offer}
                business={business}
                categories={categories}
                dateId={
                  offer.occurrences.some((o) => o.date_id === date)
                    ? date
                    : undefined
                }
                track={track}
              />
            </>
          ) : (
            <div className="detail-body">
              <h2>This offer is no longer available.</h2>
              <p>
                Explore the latest offers to find another plan for your evening.
              </p>
            </div>
          )}
        </Dialog>
      )}
      {venues && (
        <Dialog label="Offers at this location" onClose={() => setVenues(null)}>
          <div className="detail-body">
            <p className="eyebrow">RIGHT HERE IN FALMOUTH</p>
            <h2>
              {venues.length === 1 ? venues[0].name : "A few local favourites"}
            </h2>
            {matched
              .filter((o) => venues.some((v) => v.id === o.business_id))
              .map((o) => (
                <button
                  className="venue-offer-row"
                  key={o.id}
                  onClick={() => selectOffer(o)}
                >
                  <span>
                    <small>
                      {
                        data.businesses.find((b) => b.id === o.business_id)
                          ?.name
                      }
                    </small>
                    <strong>{o.title}</strong>
                    <CategoryPills ids={o.categories} categories={categories} />
                  </span>
                  <Icon name="right" />
                </button>
              ))}
          </div>
        </Dialog>
      )}
      {privacy && (
        <Dialog label="Privacy and cookies" onClose={() => setPrivacy(false)}>
          <div className="detail-body">
            <h2>Privacy & cookies</h2>
            <p>
              This app is organised by Falmouth BID. Staff sign-in uses an
              essential session cookie. The interactive map connects to Mapbox
              when you open it.
            </p>
            <p>
              With your permission, Google Analytics helps us understand which
              offers people explore. You can browse without analytics.
            </p>
            <a
              className="text-link"
              href="https://www.falmouth.co.uk/information/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the website privacy policy <Icon name="external" />
            </a>
            <div className="detail-actions">
              <button
                className="button primary"
                onClick={() => chooseConsent("yes")}
              >
                Allow analytics
              </button>
              <button
                className="button secondary"
                onClick={() => chooseConsent("no")}
              >
                Use essential only
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {data.config.gaId && !consent && !data.demo && (
        <aside className="consent-banner" aria-label="Analytics preference">
          <p>Help us improve your next evening out? Allow usage analytics.</p>
          <button
            className="button small primary"
            onClick={() => chooseConsent("yes")}
          >
            Allow analytics
          </button>
          <button
            className="button small secondary"
            onClick={() => chooseConsent("no")}
          >
            Essential only
          </button>
        </aside>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
