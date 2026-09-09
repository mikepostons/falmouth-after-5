export function ukDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function availableDates(data, now = new Date()) {
  const today = ukDay(now);
  return [...data.dates]
    .filter(
      (d) =>
        d.date >= today ||
        data.offers.some((o) =>
          o.occurrences.some(
            (v) => v.date_id === d.id && new Date(v.end_iso) > now,
          ),
        ),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function defaultDate(data, now = new Date()) {
  return availableDates(data, now)[0]?.id || "";
}
export function matchingOffers(
  data,
  dateId,
  search = "",
  categories = [],
  now = new Date(),
) {
  const q = search.trim().toLocaleLowerCase("en-GB");
  const venues = new Map(data.businesses.map((b) => [b.id, b]));
  return data.offers.filter(
    (o) =>
      o.occurrences.some(
        (v) => v.date_id === dateId && new Date(v.end_iso) > now,
      ) &&
      (!categories.length ||
        o.categories.some((c) => categories.includes(c))) &&
      (!q ||
        `${venues.get(o.business_id)?.name} ${o.title} ${o.description}`
          .toLocaleLowerCase("en-GB")
          .includes(q)),
  );
}
export function firstFriday(month) {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCDate(1 + ((5 - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}
export function dateLabel(date, short = false) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: short ? "short" : "long",
    ...(short ? {} : { weekday: "long", year: "numeric" }),
    timeZone: "Europe/London",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function timeLabel(value) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Europe/London",
  })
    .format(new Date(value))
    .replace(":00", "")
    .replace(" ", "");
}
