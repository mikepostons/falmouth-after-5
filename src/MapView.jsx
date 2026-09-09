import React, { useEffect, useRef, useState } from "react";
import Icon from "./icons";
import { createRoot } from "react-dom/client";
export default function MapView({
  config,
  businesses,
  offers,
  categories,
  onSelect,
  picker,
  onPick,
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
  const redraw = useRef(() => {});
  useEffect(() => {
    let cancelled = false,
      timeout;
    let map;
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
          center: [-5.0678, 50.1541],
          zoom: 14.8,
          pitch: picker ? 0 : 48,
          bearing: -18,
          attributionControl: true,
        });
        mapRef.current = map;
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
          if (!map.loaded()) return;
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
          groups.forEach(({ venues }) => {
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
              <span>
                {venues.length > 1 ? (
                  venues.length
                ) : (
                  <Icon name={cats[0]?.icon || "pin"} size={21} />
                )}
              </span>,
            );
            button.onclick = (e) => {
              e.stopPropagation();
              if (venues.length > 1 && !picker) {
                onSelect(venues);
                return;
              }
              onSelect?.(venues);
            };
            const marker = new mapboxgl.Marker({
              element: button,
              anchor: "bottom",
              draggable: !!picker,
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
        map.on("load", () => {
          clearTimeout(timeout);
          if (!cancelled) {
            setState("ready");
            redraw.current();
          }
        });
        map.on("moveend", () => redraw.current());
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
      clearTimeout(timeout);
      markers.current.forEach((m) => {
        m.root?.unmount();
        m.marker.remove();
      });
      markers.current = [];
      map?.remove();
      mapRef.current = null;
    };
  }, [config?.mapboxToken, config?.mapStyle, picker]);
  const markerSignature = JSON.stringify({
    businesses: businesses.map(({ id, name, lat, lng }) => ({
      id,
      name,
      lat,
      lng,
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
        aria-label={
          picker
            ? "Set the business location"
            : "Map of participating Falmouth businesses"
        }
      />
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
      {state === "ready" && !picker && (
        <div className="map-tools">
          <button
            onClick={() => {
              const next = !tilted;
              setTilted(next);
              mapRef.current.easeTo({
                pitch: next ? 48 : 0,
                duration: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? 0
                  : 450,
              });
            }}
          >
            {tilted ? "2D view" : "3D view"}
          </button>
          <button
            onClick={() =>
              mapRef.current.easeTo({
                center: [-5.0678, 50.1541],
                zoom: 14.8,
                bearing: -18,
                duration: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? 0
                  : 450,
              })
            }
          >
            <Icon name="compass" /> Reset view
          </button>
        </div>
      )}
    </div>
  );
}
