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
export function nextOfferDate(data, now = new Date()) {
  return (
    availableDates(data, now).find((day) =>
      data.offers.some((offer) =>
        offer.occurrences.some(
          (occurrence) =>
            occurrence.date_id === day.id && new Date(occurrence.end_iso) > now,
        ),
      ),
    )?.id || ""
  );
}
export function matchingOffers(
  data,
  dateId,
  search = "",
  categories = [],
  now = new Date(),
) {
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-GB");
  const terms = normalize(search).trim().split(/\s+/).filter(Boolean);
  const aliases = {
    food: "eat eating dining dine meal meals restaurant restaurants",
    drinks: "drink drinking bar bars pub pubs",
    shopping: "shop shops retail",
    entertainment: "entertainment entertain",
    experiences: "experience activities activity things to do",
    wellbeing: "wellness wellbeing well-being",
  };
  const categoryNames = new Map((data.categories || []).map((category) => [category.id, category.name]));
  const venues = new Map(data.businesses.map((b) => [b.id, b]));
  return data.offers.filter(
    (o) =>
      o.occurrences.some(
        (v) => v.date_id === dateId && new Date(v.end_iso) > now,
      ) &&
      (!categories.length ||
        o.categories.some((c) => categories.includes(c))) &&
      terms.every((term) => {
        const categoryText = o.categories.map((id) => {
          const name = normalize(categoryNames.get(id) || id);
          return `${name} ${aliases[name] || ""}`;
        }).join(" ");
        return normalize(`${venues.get(o.business_id)?.name || ""} ${o.title || ""} ${o.description || ""} ${categoryText}`).includes(term);
      }),
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

// Draft previews use the same campaign inclusion rules as the public API.
export function campaignOccurrences(offer, campaigns) {
  if (!offer.schedule_mode || offer.legacy_schedule)
    return offer.occurrences || [];
  const ids = offer.campaign_ids || [];
  const last =
    campaigns
      .filter((d) => ids.includes(d.id))
      .map((d) => d.date)
      .sort()
      .at(-1) || "";
  return campaigns
    .filter(
      (d) =>
        offer.schedule_mode === "all" ||
        ids.includes(d.id) ||
        (offer.roll_over && last && d.date > last),
    )
    .map((d) => {
      const day = new Date(d.date + "T12:00:00Z");
      if (offer.end_time <= offer.start_time)
        day.setUTCDate(day.getUTCDate() + 1);
      return {
        date_id: d.id,
        start: d.date + "T" + offer.start_time,
        end: day.toISOString().slice(0, 10) + "T" + offer.end_time,
      };
    });
}
