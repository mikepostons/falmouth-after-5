import React, { useEffect, useRef, useState } from "react";
import Icon from "./icons";
import { createRoot } from "react-dom/client";
const START_CAMERA = {
  center: [-5.072306, 50.154508],
  zoom: 15.28,
  bearing: 94,
  pitch: 65,
};

export default function MapView({
  config,
  businesses,
  offers,
  categories,
  onSelect,
  picker,
  onPick,
  clusterZoom = false,
  hideTools = false,
  onControls,
  onReady,
}) {
  const el = useRef(null),
    mapRef = useRef(null),
    markers = useRef([]),
    latest = useRef({
      businesses,
      offers,
      categories,
      onSelect,
      picker,
      onPick,
    });
  latest.current = { businesses, offers, categories, onSelect, picker, onPick };
  const [state, setState] = useState("loading"),
    [tilted, setTilted] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);
  const contextRef = useRef(null);
  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = (event) => {
      if (!contextRef.current?.contains(event.target)) setContextMenu(null);
    };
    const onKey = (event) => { if (event.key === "Escape") setContextMenu(null); };
    const close = () => setContextMenu(null);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);
  const redraw = useRef(() => {});
  useEffect(() => {
    let cancelled = false,
      timeout;
    let map;
    let cancelFocus = () => {};
    async function init() {
      if (!config?.mapboxToken) {
        setState("unavailable");
        return;
      }
      try {
        const { default: mapboxgl } = await import("mapbox-gl");
        await import("mapbox-gl/dist/mapbox-gl.css");
        if (cancelled) return;
        if (!mapboxgl.supported()) {
          setState("unavailable");
          return;
        }
        map = new mapboxgl.Map({
          container: el.current,
          accessToken: config.mapboxToken,
          style: config.mapStyle || "mapbox://styles/mapbox/standard",
          ...START_CAMERA,
          ...(picker &&
          Number.isFinite(latest.current.businesses[0]?.lng) &&
          Number.isFinite(latest.current.businesses[0]?.lat)
            ? {
                center: [
                  latest.current.businesses[0].lng,
                  latest.current.businesses[0].lat,
                ],
                zoom: 16.5,
              }
            : {}),
          pitch: picker ? 0 : START_CAMERA.pitch,
          bearing: picker ? 0 : START_CAMERA.bearing,
          attributionControl: true,
        });
        mapRef.current = map;
        const duration = () =>
          matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;
        onControls?.({
          cancelFocus: () => cancelFocus(),
          focusVenue: (business, onArrival) => {
            cancelFocus();
            if (
              !map.isStyleLoaded() ||
              !Number.isFinite(business?.lng) ||
              !Number.isFinite(business?.lat)
            ) {
              onArrival();
              return;
            }
            map.stop();
            let active = true;
            const clear = () => {
              active = false;
              map.off("moveend", arrive);
              map.off("mousedown", clear);
              map.off("wheel", clear);
              map.off("touchstart", clear);
            };
            const arrive = () => {
              if (!active) return;
              clear();
              if (!cancelled) onArrival();
            };
            cancelFocus = clear;
            map.on("moveend", arrive);
            map.on("mousedown", clear);
            map.on("wheel", clear);
            map.on("touchstart", clear);
            map.easeTo({
              center: [business.lng, business.lat],
              zoom: Math.max(map.getZoom(), 17.6),
              duration: duration() ? 850 : 0,
            });
            if (!map.isMoving()) arrive();
          },
          setPitch: (enabled) => {
            setTilted(enabled);
            map.easeTo({
              pitch: enabled ? START_CAMERA.pitch : 0,
              duration: duration(),
            });
          },
          reset: () => {
            setTilted(true);
            map.easeTo({ ...START_CAMERA, duration: duration() });
          },
        });
        map.addControl(
          new mapboxgl.NavigationControl({ visualizePitch: true }),
          "bottom-right",
        );
        timeout = setTimeout(() => {
          if (!cancelled) setState("unavailable");
        }, 18000);
        const removeMarkers = () => {
          markers.current.forEach((m) => {
            m.root?.unmount();
            m.marker.remove();
          });
          markers.current = [];
        };
        redraw.current = () => {
          if (!map.isStyleLoaded()) return;
          removeMarkers();
          const { businesses, offers, categories, onSelect, picker } =
            latest.current;
          const used = picker
            ? businesses
            : businesses.filter((b) =>
                offers.some((o) => o.business_id === b.id),
              );
          // Screen-space grouping keeps small venue sets accessible, including exact overlaps.
          const groups = [];
          used
            .filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng))
            .forEach((b) => {
              const p = map.project([b.lng, b.lat]);
              let group = groups.find(
                (g) => Math.hypot(g.p.x - p.x, g.p.y - p.y) < 44,
              );
              if (!group) {
                group = { p, venues: [] };
                groups.push(group);
              }
              group.venues.push(b);
            });
          // At street scale, fan out pins that share coordinates so every venue stays selectable.
          const displayed =
            clusterZoom && map.getZoom() >= 19
              ? groups.flatMap((g) =>
                  g.venues.map((v, i) => ({
                    venues: [v],
                    offset:
                      g.venues.length > 1
                        ? [
                            Math.cos((i * 2 * Math.PI) / g.venues.length) *
                              Math.max(55, g.venues.length * 9),
                            Math.sin((i * 2 * Math.PI) / g.venues.length) *
                              Math.max(55, g.venues.length * 9),
                          ]
                        : [0, 0],
                  })),
                )
              : groups;
          displayed.forEach(({ venues, offset = [0, 0] }) => {
            const b = venues[0],
              button = document.createElement("button");
            button.className = "venue-marker";
            button.type = "button";
            const ids = [
              ...new Set(
                offers
                  .filter((o) => venues.some((v) => v.id === o.business_id))
                  .flatMap((o) => o.categories),
              ),
            ];
            const cats = categories.filter((c) => ids.includes(c.id));
            const colours = cats.length
              ? cats.map((c) => c.colour)
              : ["#004b91"];
            button.style.background = `conic-gradient(${colours.map((c, i) => `${c} ${(i / colours.length) * 100}% ${((i + 1) / colours.length) * 100}%`).join(",")})`;
            button.setAttribute(
              "aria-label",
              venues.length > 1
                ? `${venues.length} venues: ${venues.map((v) => v.name).join(", ")}`
                : `${b.name}: ${cats.map((c) => c.name).join(", ")}`,
            );
            const root = createRoot(button);
            root.render(
              <>
                <span>
                  {venues.length > 1 ? (
                    venues.length
                  ) : (
                    <Icon name={cats[0]?.icon || "pin"} size={21} />
                  )}
                </span>
                {!picker && (
                  <span className="venue-hover-card" aria-hidden="true">
                    {venues.slice(0, 3).map((venue) => (
                      <span className="venue-hover-row" key={venue.id}>
                        {venue.image ? (
                          <img src={"./" + venue.image} alt="" loading="lazy" />
                        ) : (
                          <span className="venue-hover-placeholder">
                            <Icon name="pin" size={24} />
                          </span>
                        )}
                        <span className="venue-hover-copy">
                          <strong>{venue.name}</strong>
                          <span className="venue-hover-types">
                            {categories
                              .filter((category) =>
                                offers.some(
                                  (offer) =>
                                    offer.business_id === venue.id &&
                                    offer.categories.includes(category.id),
                                ),
                              )
                              .map((category) => (
                                <span
                                  key={category.id}
                                  style={{ color: category.colour }}
                                >
                                  {category.name}
                                </span>
                              ))}
                          </span>
                        </span>
                      </span>
                    ))}
                    {venues.length > 3 && (
                      <span className="venue-hover-more">
                        +{venues.length - 3} more venues
                      </span>
                    )}
                    {venues.length > 1 && (
                      <span className="venue-hover-hint">
                        Click to explore these venues
                      </span>
                    )}
                  </span>
                )}
              </>,
            );
            const positionHover = () => {
              button.classList.remove("hover-dismissed");
              const point = map.project([b.lng, b.lat]);
              button.classList.toggle(
                "hover-below",
                point.y + offset[1] < Math.min(260, venues.length * 80 + 70),
              );
              button.classList.toggle(
                "hover-align-left",
                point.x + offset[0] < 140,
              );
              button.classList.toggle(
                "hover-align-right",
                point.x + offset[0] > el.current.clientWidth - 140,
              );
            };
            button.addEventListener("mouseenter", positionHover);
            button.addEventListener("focus", positionHover);
            button.addEventListener("keydown", (e) => {
              if (e.key === "Escape") button.classList.add("hover-dismissed");
            });
            button.onclick = (e) => {
              e.stopPropagation();
              if (venues.length > 1 && !picker) {
                if (clusterZoom) {
                  const bounds = new mapboxgl.LngLatBounds();
                  venues.forEach((v) => bounds.extend([v.lng, v.lat]));
                  const camera = map.cameraForBounds(bounds, {
                    padding: 100,
                    maxZoom: 19,
                  });
                  map.easeTo({
                    ...camera,
                    pitch: map.getPitch(),
                    bearing: map.getBearing(),
                    center: bounds.getCenter(),
                    zoom: Math.min(
                      19,
                      Math.max(map.getZoom() + 2, camera?.zoom || 19),
                    ),
                    duration: duration(),
                  });
                } else onSelect(venues);
                return;
              }
              onSelect?.(venues);
            };
            const marker = new mapboxgl.Marker({
              element: button,
              anchor: "bottom",
              draggable: !!picker,
              offset,
            })
              .setLngLat([b.lng, b.lat])
              .addTo(map);
            button.setAttribute("role", "button");
            if (picker)
              marker.on("dragend", () =>
                latest.current.onPick?.(marker.getLngLat()),
              );
            markers.current.push({ marker, root });
          });
        };
        map.once("idle", () => { if (!cancelled) onReady?.(); });
        map.on("load", () => {
          clearTimeout(timeout);
          if (!cancelled) {
            setState("ready");
            redraw.current();
          }
        });
        map.on("moveend", () => redraw.current());
        map.on("idle", () => {
          if (!picker) redraw.current();
        });
        map.on("click", (e) => {
          if (latest.current.picker) latest.current.onPick?.(e.lngLat);
        });
        map.on("error", (e) => {
          if (e.error?.status === 401 || e.error?.status === 403) {
            clearTimeout(timeout);
            if (!cancelled) setState("unavailable");
          }
        });
      } catch {
        if (!cancelled) setState("unavailable");
      }
    }
    init();
    return () => {
      cancelled = true;
      cancelFocus();
      clearTimeout(timeout);
      markers.current.forEach((m) => {
        m.root?.unmount();
        m.marker.remove();
      });
      markers.current = [];
      map?.remove();
      mapRef.current = null;
      onControls?.(null);
    };
  }, [config?.mapboxToken, config?.mapStyle, picker]);
  const markerSignature = JSON.stringify({
    businesses: businesses.map(({ id, name, lat, lng, image }) => ({
      id,
      name,
      lat,
      lng,
      image,
    })),
    offers: offers.map(({ id, business_id, categories }) => ({
      id,
      business_id,
      categories,
    })),
    categories,
  });
  useEffect(() => {
    redraw.current();
  }, [markerSignature]);
  useEffect(() => {
    const ro = new ResizeObserver(() => mapRef.current?.resize());
    if (el.current) ro.observe(el.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div className={"map-shell " + (picker ? "picker-map" : "")}>
      <div
        ref={el}
        className="map-canvas"
        onContextMenu={picker ? undefined : (event) => {
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          setContextMenu({
            left: Math.max(12, Math.min(event.clientX - bounds.left, bounds.width - 292)),
            top: Math.max(12, Math.min(event.clientY - bounds.top, bounds.height - 172)),
          });
        }}
        aria-label={
          picker
            ? "Set the business location"
            : "Map of participating Falmouth businesses"
        }
      />
      {contextMenu && !picker && (
        <aside ref={contextRef} className="map-credit-menu" style={contextMenu} aria-label="Mapping tool credit">
          <p>Interactive mapping tool developed by <strong>3deep Media</strong></p>
          <a href="https://3deepmedia.com/" target="_blank" rel="noopener noreferrer" onClick={() => setContextMenu(null)}>
            Visit 3deep Media <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </aside>
      )}
      {state !== "ready" && (
        <div className="map-status">
          <Icon name="map" size={42} />
          <h3>
            {state === "loading"
              ? "Finding our way around…"
              : "The map is taking a break"}
          </h3>
          <p>
            {state === "loading"
              ? "Your offers are ready to browse."
              : "You can still explore every offer in the list and open directions from its details."}
          </p>
        </div>
      )}
      {state === "ready" && !picker && !hideTools && (
        <div className="map-tools">
          <button
            onClick={() => {
              const next = !tilted;
              setTilted(next);
              mapRef.current.easeTo({
                pitch: next ? START_CAMERA.pitch : 0,
                duration: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? 0
                  : 450,
              });
            }}
          >
            {tilted ? "2D view" : "3D view"}
          </button>
          <button
            onClick={() => {
              setTilted(true);
              mapRef.current.easeTo({
                ...START_CAMERA,
                duration: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? 0
                  : 450,
              });
            }}
          >
            <Icon name="compass" /> Reset view
          </button>
        </div>
      )}
    </div>
  );
}
