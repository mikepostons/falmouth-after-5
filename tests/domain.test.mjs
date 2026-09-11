import test from "node:test";
import assert from "node:assert/strict";
import {
  firstFriday,
  matchingOffers,
  availableDates,
  defaultDate,
  nextOfferDate,
  ukDay,
  campaignOccurrences,
} from "../src/domain.js";
const data = {
  dates: [
    { id: "old", date: "2026-09-04" },
    { id: "now", date: "2026-10-02" },
    { id: "next", date: "2026-11-06" },
  ],
  businesses: [{ id: "b", name: "The Poly" }],
  offers: [
    {
      id: "mixed",
      business_id: "b",
      title: "Food + drinks",
      description: "Dinner",
      categories: ["food", "drinks"],
      occurrences: [{ date_id: "now", end_iso: "2026-10-03T01:00:00+01:00" }],
    },
    {
      id: "cinema",
      business_id: "b",
      title: "Cinema",
      description: "Film night",
      categories: ["entertainment"],
      occurrences: [{ date_id: "now", end_iso: "2026-10-02T23:00:00+01:00" }],
    },
  ],
};
test("first Friday across month boundaries", () => {
  assert.equal(firstFriday("2026-10"), "2026-10-02");
  assert.equal(firstFriday("2027-01"), "2027-01-01");
});
test("multiple categories use OR and do not duplicate offers", () => {
  assert.equal(
    matchingOffers(
      data,
      "now",
      "",
      ["food", "drinks"],
      new Date("2026-10-02T16:00:00Z"),
    ).length,
    1,
  );
});
test("search is case insensitive and combines with categories and dates", () => {
  assert.equal(
    matchingOffers(
      data,
      "now",
      "POLY",
      ["entertainment"],
      new Date("2026-10-02T16:00:00Z"),
    )[0].id,
    "cinema",
  );
  assert.equal(
    matchingOffers(data, "next", "POLY", [], new Date("2026-10-02T16:00:00Z"))
      .length,
    0,
  );
});
test("overnight remains under starting campaign date until end", () => {
  const now = new Date("2026-10-03T00:30:00+01:00");
  assert.equal(defaultDate(data, now), "now");
  assert.equal(matchingOffers(data, "now", "", [], now).length, 1);
  assert.equal(
    defaultDate(data, new Date("2026-10-03T01:00:00+01:00")),
    "next",
  );
});
test("UK day uses local daylight saving time", () =>
  assert.equal(ukDay(new Date("2026-10-01T23:30:00Z")), "2026-10-02"));
test("ended dates are absent and exact end time is expired", () => {
  assert.equal(availableDates(data, new Date("2026-10-04")).length, 1);
  assert.equal(
    matchingOffers(data, "now", "", [], new Date("2026-10-03T00:00:00Z"))
      .length,
    0,
  );
});

test("next offer date skips empty and ended campaigns", () => {
  const fixture = {
    dates: [
      { id: "later", date: "2026-11-06" },
      { id: "empty", date: "2026-09-11" },
      { id: "next", date: "2026-10-02" },
      { id: "past", date: "2026-09-04" },
    ],
    offers: [
      {
        occurrences: [
          { date_id: "past", end_iso: "2026-09-04T20:00:00Z" },
          { date_id: "next", end_iso: "2026-10-02T20:00:00Z" },
          { date_id: "later", end_iso: "2026-11-06T20:00:00Z" },
        ],
      },
    ],
  };
  assert.equal(
    nextOfferDate(fixture, new Date("2026-09-09T12:00:00Z")),
    "next",
  );
  assert.equal(
    nextOfferDate(fixture, new Date("2026-10-02T20:00:00Z")),
    "later",
  );
  assert.equal(nextOfferDate(fixture, new Date("2026-11-07T12:00:00Z")), "");
});

test("campaign preview and upcoming selection handle roll-over and expiry", () => {
  const campaigns = [
    { id: "nov", date: "2026-11-06" },
    { id: "dec", date: "2026-12-04" },
    { id: "jan", date: "2027-01-01" },
  ];
  const offer = {
    schedule_mode: "specific",
    campaign_ids: ["nov"],
    roll_over: true,
    start_time: "17:00",
    end_time: "01:00",
  };
  const occurrences = campaignOccurrences(offer, campaigns).map((o) => ({
    ...o,
    start_iso: o.start + ":00Z",
    end_iso: o.end + ":00Z",
  }));
  assert.equal(occurrences.length, 3);
  assert.equal(occurrences[0].end, "2026-11-07T01:00");
  assert.equal(
    nextOfferDate(
      { dates: campaigns, offers: [{ occurrences }] },
      new Date("2026-11-07T01:00:00Z"),
    ),
    "dec",
  );
  assert.equal(
    campaignOccurrences({ ...offer, roll_over: false }, campaigns).length,
    1,
  );
  assert.equal(
    campaignOccurrences(
      { ...offer, schedule_mode: "all", campaign_ids: [] },
      campaigns,
    ).length,
    3,
  );
});

test("search finds category names, generic terms and combined words without ignoring campaign filters", () => {
  const fixture = {
    ...data,
    categories: [{ id: "cat-1", name: "Food" }, { id: "cat-2", name: "Local crafts" }],
    offers: [{ ...data.offers[0], title: "Evening special", description: "Two for one", categories: ["cat-1"] },
      { ...data.offers[1], categories: ["cat-2"] }],
  };
  const now = new Date("2026-10-02T16:00:00Z");
  for (const query of ["food", " FOOD ", "restaurants", "dining", "poly food", "food special"])
    assert.deepEqual(matchingOffers(fixture, "now", query, [], now).map(o => o.id), ["mixed"]);
  assert.deepEqual(matchingOffers(fixture, "now", "crafts", [], now).map(o => o.id), ["cinema"]);
  assert.equal(matchingOffers(fixture, "now", "food", ["cat-2"], now).length, 0);
  assert.equal(matchingOffers(fixture, "next", "food", [], now).length, 0);
  assert.equal(matchingOffers(fixture, "now", "unmatched", [], now).length, 0);
});
