import test from "node:test";
import assert from "node:assert/strict";
import {
  firstFriday,
  matchingOffers,
  availableDates,
  defaultDate,
  ukDay,
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
