/**
 * Today's date in Dubai, as YYYY-MM-DD.
 *
 * Not `new Date().toISOString().slice(0, 10)`. The Worker runs on UTC and Dubai
 * is UTC+4, so from 8pm local until midnight that expression returns yesterday
 * — which is precisely the evening hours someone is most likely to be writing
 * down what they did today.
 *
 * A fixed offset rather than a timezone lookup: the UAE has observed UTC+4 with
 * no daylight saving since 1972, so there is no rule here to get out of date.
 */
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

export const todayInDubai = (at: Date = new Date()): string =>
  new Date(at.getTime() + DUBAI_OFFSET_MS).toISOString().slice(0, 10);
