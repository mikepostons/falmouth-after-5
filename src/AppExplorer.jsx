import {siteCopy} from "./site-copy";
import React, { Suspense, useState, useRef, useEffect } from "react";
import Icon from "./icons";
import ExplorerMenu from "./ExplorerMenu";
import WelcomeSplash from "./WelcomeSplash";
import { dateLabel, timeLabel } from "./domain";
import "./app-explorer.css";
import "@fontsource/yellowtail/400.css";

export default function AppExplorer({
  MapView,
  data,
  view,
  setView,
  date,
  setDate,
  dates,
  current,
  search,
  setSearch,
  filters,
  setFilters,
  categories,
  visibleCats,
  matched,
  selectOffer,
  setVenues,
  track,
  error,
  load,
  onPrivacy,
  onUsable,
}) {
  const [introducing, setIntroducing] = useState(() => !new URLSearchParams(location.search).has("offer") && !matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [mapReady, setMapReady] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const departing = introducing && loadingComplete;
  useEffect(() => {
    if (!departing) return;
    const timer = setTimeout(() => setIntroducing(false), 1500);
    return () => clearTimeout(timer);
  }, [departing]);
  useEffect(() => { if (!introducing) onUsable?.(); }, [introducing, onUsable]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => matchMedia("(max-width: 760px)").matches,
  );
  const explorerRoot = useRef(null);
  const searchInput = useRef(null);
  const searchTrigger = useRef(null);
  useEffect(() => {
    const mq = matchMedia("(max-width: 760px)");
    const update = () => {
      setIsMobile(mq.matches);
      if (!mq.matches) setMobileSearch(false);
    };
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (mobileSearch) searchInput.current?.focus();
  }, [mobileSearch]);
  useEffect(() => {
    if (!isMobile || !mobileSearch) return;
    const backgrounds = [...explorerRoot.current.children].filter(
      (el) =>
        !el.classList.contains("app-search-tools") &&
        !el.classList.contains("app-mobile-search-backdrop"),
    );
    const previous = backgrounds.map((el) => el.inert);
    backgrounds.forEach((el) => {
      el.inert = true;
    });
    return () =>
      backgrounds.forEach((el, i) => {
        el.inert = previous[i];
      });
  }, [isMobile, mobileSearch]);
  const closeMobileSearch = () => {
    setMobileSearch(false);
    setSearchOpen(false);
    requestAnimationFrame(() => searchTrigger.current?.focus());
  };
  const [about, setAbout] = useState(false);
  const [settings, setSettings] = useState(false);
  const [tilted, setTilted] = useState(true);
  const mapControls = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(-1);
  const resultsId = React.useId();
  const searchActive = !!search.trim();
  const searchResultLabel = `${matched.length} ${matched.length === 1 ? "offer matches" : "offers match"} “${search.trim()}”. Search filter active.`;
  const searchCounter = <span className="app-search-count" role="status" aria-label={searchResultLabel} title={searchResultLabel}>{matched.length}</span>;
  const resultsVisible = searchOpen && searchActive;
  const chooseResult = (offer) => {
    setSearchOpen(false);
    setMobileSearch(false);
    setActiveResult(-1);
    openOffer(offer);
  };
  const changeView = (next) => {
    mapControls.current?.cancelFocus?.();
    setView(next);
    track("view_change", { view: next });
  };
  const openOffer = (offer) => {
    const business = data.businesses.find((b) => b.id === offer.business_id);
    if (
      window.matchMedia("(min-width: 761px)").matches &&
      mapControls.current?.focusVenue &&
      business
    ) {
      mapControls.current.focusVenue(business, () => selectOffer(offer));
    } else selectOffer(offer);
  };
  const reset = () => {
    setFilters([]);
    setSearch("");
  };
  const viewSwitch = (
    <div className="app-view-switch floating-surface" aria-label="View options">
      <button
        aria-pressed={view !== "list"}
        className={view !== "list" ? "active" : ""}
        onClick={() => changeView("map")}
      >
        <Icon name="map" />
        Map
      </button>
      <button
        aria-pressed={view === "list"}
        className={view === "list" ? "active" : ""}
        onClick={() => changeView("list")}
      >
        <Icon name="list" />
        List
      </button>
    </div>
  );
  return (
    <>
    {introducing && <WelcomeSplash mapReady={mapReady} departing={departing} onComplete={() => setLoadingComplete(true)} />}
    <main
      ref={explorerRoot}
      inert={introducing}
      className={`app-explorer ${introducing ? "is-introducing" : ""} ${departing ? "intro-departing" : ""} ${view === "list" ? "is-list" : "is-map"}`}
      id="main"
    >
      <div className="app-map-background">
        <Suspense
          fallback={<div className="map-status">Opening Falmouth…</div>}
        >
          <MapView
            config={data.config}
            businesses={data.businesses}
            offers={matched}
            categories={categories.filter(
              (c) => !filters.length || filters.includes(c.id),
            )}
            clusterZoom
            hideTools
            onReady={() => setMapReady(true)}
            onControls={(controls) => {
              mapControls.current = controls;
            }}
            onSelect={(venues) => {
              const offers = matched.filter((o) =>
                venues.some((v) => v.id === o.business_id),
              );
              if (venues.length === 1 && offers.length) openOffer(offers[0]);
              else setVenues(venues);
            }}
          />
        </Suspense>
      </div>
      <header className="app-header" inert={isMobile && view === "list"}>
        <div className="app-brand floating-surface">
          <button
            className="brand-button"
            onClick={() => setAbout(!about)}
            aria-expanded={about}
            aria-label="About Falmouth After Five"
          >
            <img
              src="./assets/logo-falmouth-after-5-blue.svg?v=20260914"
              alt="Falmouth After Five"
            />
          </button>
          <p className="app-brand-tagline">
            <span>
              Rediscover
              <br />
              Falmouth
              <br />
              After Dark
            </span>
          </p>
        </div>
      </header>
      <button
        className="app-menu-trigger icon-button"
        inert={isMobile && view === "list"}
        aria-label="Open menu"
        onClick={() => {
          mapControls.current?.cancelFocus?.();
          setMenuOpen(true);
        }}
      >
        <Icon name="list" size={23} />
      </button>
      <button
        ref={searchTrigger}
        className="app-mobile-search-trigger icon-button"
        inert={isMobile && view === "list"}
        aria-label={searchActive ? `Open search. ${searchResultLabel}` : "Open search"}
        hidden={mobileSearch}
        onClick={() => {
          setMobileSearch(true);
          setSearchOpen(true);
        }}
      >
        <Icon name="search" size={23} />
        {searchActive && searchCounter}
      </button>
      {isMobile && mobileSearch && (
        <div className="app-mobile-search-backdrop" />
      )}
      {menuOpen && (
        <ExplorerMenu
          data={data}
          MapView={MapView}
          onClose={() => setMenuOpen(false)}
          onPrivacy={onPrivacy}
        />
      )}
      <div
        className={`app-search-tools floating-surface ${mobileSearch ? "mobile-search-active" : ""}`}
        role={isMobile && mobileSearch ? "dialog" : undefined}
        aria-modal={isMobile && mobileSearch ? true : undefined}
        aria-label={
          isMobile && mobileSearch ? "Search businesses and offers" : undefined
        }
        onKeyDown={(e) => {
          if (!isMobile || !mobileSearch) return;
          if (e.key === "Escape") {
            e.stopPropagation();
            closeMobileSearch();
          }
          if (e.key === "Tab") {
            const items = [
              ...e.currentTarget.querySelectorAll("input, button, select"),
            ].filter((el) => el.tabIndex >= 0 && el.getClientRects().length);
            const first = items[0],
              last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setSearchOpen(false);
        }}
      >
        <label className="app-search">
          <Icon name="search" />
          <input
            ref={searchInput}
            aria-label="Search businesses and offers"
            placeholder="Find Offers"
            value={search}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={resultsVisible}
            aria-controls={resultsVisible ? resultsId : undefined}
            aria-activedescendant={
              resultsVisible && matched[activeResult]
                ? `${resultsId}-${matched[activeResult].id}`
                : undefined
            }
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchOpen(true);
              setActiveResult(-1);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchOpen(false);
                setActiveResult(-1);
                return;
              }
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setSearchOpen(true);
                if (matched.length) {
                  const next =
                    e.key === "ArrowDown"
                      ? (activeResult + 1) % matched.length
                      : activeResult <= 0
                        ? matched.length - 1
                        : activeResult - 1;
                  setActiveResult(next);
                  document
                    .getElementById(`${resultsId}-${matched[next].id}`)
                    ?.scrollIntoView({ block: "nearest" });
                }
              }
              if (e.key === "Enter" && resultsVisible && matched.length) {
                e.preventDefault();
                chooseResult(matched[activeResult] || matched[0]);
              }
            }}
          />
          {searchActive && searchCounter}
          {search && (
            <button aria-label="Clear search" onClick={() => setSearch("")}>
              <Icon name="close" size={18} />
            </button>
          )}
        </label>

        {isMobile && mobileSearch && (
          <button
            className="app-mobile-search-close icon-button"
            aria-label="Close search"
            onClick={closeMobileSearch}
          >
            <Icon name="close" />
          </button>
        )}
        {isMobile && mobileSearch && !search.trim() && (
          <div className="app-search-intro">
            <h1>Find Offers</h1>
            <p>Search for a business, food, drinks or an offer.</p>
          </div>
        )}
        {resultsVisible && (
          <div className="app-search-results floating-surface">
            <p className="app-search-result-count" role="status">
              {matched.length
                ? `${matched.length} matching ${matched.length === 1 ? "offer" : "offers"}`
                : "No matching offers"}
            </p>
            <div
              role="listbox"
              id={resultsId}
              aria-label="Search results"
              className="app-search-result-list"
            >
              {matched.map((offer, index) => {
                const business = data.businesses.find(
                  (b) => b.id === offer.business_id,
                );
                const photo = offer.image || business?.image;
                return (
                  <button
                    key={offer.id}
                    id={`${resultsId}-${offer.id}`}
                    role="option"
                    aria-selected={index === activeResult}
                    tabIndex={-1}
                    className="app-search-result"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => chooseResult(offer)}
                  >
                    {photo ? (
                      <img src={"./" + photo} alt="" />
                    ) : (
                      <span className="app-result-placeholder">
                        <Icon name="pin" />
                      </span>
                    )}
                    <span>
                      <strong>{business?.name}</strong>
                      <small>{offer.title}</small>
                    </span>
                    <Icon name="right" size={17} />
                  </button>
                );
              })}
            </div>
            {!matched.length && (
              <p className="app-search-empty">
                Try another business or offer, or adjust your categories and
                date.
              </p>
            )}
          </div>
        )}
      </div>
      {about && (
        <section
          className="app-about floating-surface"
          aria-label="About the evening"
        >
          <button
            className="icon-button"
            aria-label="Close introduction"
            onClick={() => setAbout(false)}
          >
            <Icon name="close" />
          </button>
          <p className="eyebrow">FIRST FRIDAYS IN FALMOUTH</p>
          <h1>Stay a little longer.</h1>
          <p>
            Good food, a drink with friends and lovely local discoveries. Pick a
            pin or browse the offers to plan your evening.
          </p>
          <a
            className="text-link"
            href="https://www.falmouth.co.uk/discover-falmouth/falmouth-after-5/"
          >
            About First Fridays <Icon name="external" />
          </a>
          <div className="app-about-links">
            <button onClick={onPrivacy}>Privacy & cookies</button>
            <a href="?">Original version</a>
          </div>
        </section>
      )}
      <aside
        className="app-offers"
        inert={view !== "list"}
        aria-label="Offers and businesses"
      >
        <div className="app-panel-heading">
          <h1><Icon name="ticket" size={26} /><span>{siteCopy(data).offersTitle}</span></h1>
          <div className="app-panel-actions">
            <span
              className={`app-offer-count ${searchActive ? "search-filtered" : ""}`}
              role="status"
              aria-label={searchActive ? searchResultLabel : `${matched.length} ${matched.length === 1 ? "offer" : "offers"}`}
              title={searchActive ? searchResultLabel : undefined}
            >
              {matched.length}
            </span>
            <button
              className="icon-button"
              onClick={() => changeView("map")}
              aria-label="Close offers list"
            >
              <Icon name="close" size={24} />
            </button>
          </div>
        </div>
        <div className="app-offer-scroll">
          {(search || filters.length > 0) && (
            <button className="text-link app-clear" onClick={reset}>
              Clear search & filters <Icon name="close" size={14} />
            </button>
          )}
          {matched.map((o) => {
            const b = data.businesses.find((b) => b.id === o.business_id);
            const cats = categories.filter((c) => o.categories.includes(c.id));
            const occ = o.occurrences.find((v) => v.date_id === date);
            return (
              <button
                key={o.id}
                className="app-offer"
                onClick={() => openOffer(o)}
                style={{ "--cat": cats[0]?.colour || "#004b91" }}
              >
                <span className="app-offer-visual">
                  {o.image || b.image ? (
                    <img
                      src={"./" + (o.image || b.image)}
                      alt={o.image_alt || b.image_alt}
                      loading="lazy"
                    />
                  ) : (
                    <Icon name={cats[0]?.icon} size={29} />
                  )}
                </span>
                <span className="app-offer-copy">
                  <strong className="app-venue">{b.name}</strong>
                  <span className="app-offer-summary" title={o.title}>
                    {o.title}
                  </span>
                  <span className="app-offer-meta">
                    {cats.map((c) => (
                      <span
                        key={c.id}
                        title={c.name}
                        style={{ color: c.colour }}
                      >
                        <Icon name={c.icon} size={15} />
                        <span className="sr-only">{c.name}</span>
                      </span>
                    ))}
                    <span>
                      {o.time_note ||
                        (occ
                          ? `${timeLabel(occ.start_iso)} – ${timeLabel(occ.end_iso)}`
                          : "")}
                    </span>
                  </span>
                </span>
                <Icon name="right" size={18} />
              </button>
            );
          })}
          {!matched.length && (
            <div className="app-empty">
              <Icon name="compass" size={38} />
              <h2>
                {date
                  ? "A different kind of evening?"
                  : "Good things are on the way."}
              </h2>
              <p>
                {date
                  ? "Try another date or clear your filters to discover more."
                  : "The next evening will appear here once announced."}
              </p>
              {(search || filters.length > 0) && (
                <button className="button secondary" onClick={reset}>
                  Show all offers
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
      {error && (
        <div className="app-refresh-error" role="status">
          Showing last loaded offers.{" "}
          <button onClick={load}>Retry refresh</button>
        </div>
      )}
      <div className="app-dock">
        <div
          id="app-category-panel"
          className="app-filter-popover floating-surface"
          popover="auto"
          role="region"
          aria-label="Filter categories"
        >
          {settings ? (
            <div className="app-map-settings" aria-label="Map settings">
              <div className="app-view-switch" aria-label="Map perspective">
                <button
                  className={!tilted ? "active" : ""}
                  aria-pressed={!tilted}
                  onClick={() => {
                    setTilted(false);
                    mapControls.current?.setPitch(false);
                  }}
                >
                  2D view
                </button>
                <button
                  className={tilted ? "active" : ""}
                  aria-pressed={tilted}
                  onClick={() => {
                    setTilted(true);
                    mapControls.current?.setPitch(true);
                  }}
                >
                  3D view
                </button>
              </div>
              <button
                className="button secondary"
                onClick={() => {
                  setTilted(true);
                  mapControls.current?.reset();
                }}
              >
                <Icon name="compass" />
                Reset view
              </button>
            </div>
          ) : (
            <>
              <div className="app-category-options">
                <button
                  aria-pressed={!filters.length}
                  className={!filters.length ? "selected" : ""}
                  onClick={() => setFilters([])}
                >
                  <Icon name="compass" />
                  <span>Everything</span>
                  {!filters.length && <Icon name="check" />}
                </button>
                {visibleCats.map((c) => (
                  <button
                    key={c.id}
                    aria-pressed={filters.includes(c.id)}
                    className={filters.includes(c.id) ? "selected" : ""}
                    style={{ "--cat": c.colour }}
                    onClick={() => {
                      setFilters((v) =>
                        v.includes(c.id)
                          ? v.filter((x) => x !== c.id)
                          : [...v, c.id],
                      );
                      track("category_filter", { category_id: c.id });
                    }}
                  >
                    <span className="app-category-icon">
                      <Icon name={c.icon} />
                    </span>
                    <span>{c.name}</span>
                    {filters.includes(c.id) && <Icon name="check" />}
                  </button>
                ))}
              </div>
            </>
          )}
          <button
            className="app-settings-toggle"
            onClick={() => setSettings((v) => !v)}
            aria-pressed={settings}
          >
            <Icon name={settings ? "back" : "settings"} />
            {settings ? "Back to filters" : "Map settings"}
          </button>
        </div>
        <button
          className="app-filter-trigger floating-surface"
          popoverTarget="app-category-panel"
        >
          <Icon name="filter" />
          Filters{filters.length > 0 && <span>{filters.length}</span>}
        </button>
        {viewSwitch}
      </div>
    </main>
    </>
  );
}
