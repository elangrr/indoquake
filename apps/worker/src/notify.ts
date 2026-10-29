import { eq } from "drizzle-orm";
import type { Logger } from "pino";
import { alertSubscriptions, type Database } from "@indoquake/database";
import { haversineKm } from "@indoquake/geo";
import { areaLabel, describeLocation, formatZoned, zoneOfEvent } from "@indoquake/regions";
import {
  formatAlertMessage,
  matchesSubscription,
  type AlertEvent,
} from "@indoquake/notifications";
import { sendChannelMessage } from "@indoquake/notifications/senders";
import type { EarthquakeEvent } from "@indoquake/shared";

/**
 * Alert view of a stored event. The area is assigned from the coordinates (assignArea through
 * describeLocation, as the store does); invalid coordinates fall back to the event's own fields.
 */
export function toAlertEvent(event: EarthquakeEvent): AlertEvent {
  const location = describeLocation(event.latitude, event.longitude);
  const area = location
    ? {
        areaKind: location.kind,
        provinceSlug: location.provinceSlug,
        provinceName: location.provinceName,
        nearestProvinceSlug: location.nearestProvinceSlug,
        nearestProvinceName: location.nearestProvinceName,
        nearestProvinceKm: location.nearestProvinceKm,
        zone: location.zone,
      }
    : { ...event, zone: zoneOfEvent(event) };
  return {
    eventKey: event.eventKey,
    magnitude: event.magnitude,
    depthKm: event.depthKm,
    latitude: event.latitude,
    longitude: event.longitude,
    regionName: event.regionName,
    eventTimeWib: event.eventTimeWib,
    feltText: event.feltText,
    tsunamiPotential: event.tsunamiPotential,
    provinceSlug: area.provinceSlug ?? null,
    eventTimeUtc: event.eventTimeUtc,
    nearestProvinceSlug: area.nearestProvinceSlug ?? null,
    nearestProvinceKm: area.nearestProvinceKm ?? null,
    zone: area.zone,
    eventTimeText: formatZoned(event.eventTimeUtc, area.zone, "long"),
    areaLabel: areaLabel(area),
  };
}

export async function notifySubscriptions(
  db: Database,
  event: EarthquakeEvent,
  logger: Logger,
): Promise<number> {
  let subscriptions: (typeof alertSubscriptions.$inferSelect)[];
  try {
    subscriptions = await db
      .select()
      .from(alertSubscriptions)
      .where(eq(alertSubscriptions.active, true));
  } catch (error) {
    logger.warn({ err: error }, "subscriptions_load_failed");
    return 0;
  }
  if (subscriptions.length === 0) return 0;

  const alertEvent = toAlertEvent(event);
  let sent = 0;

  for (const subscription of subscriptions) {
    const distanceKm =
      subscription.locationLatitude !== null &&
      subscription.locationLongitude !== null
        ? haversineKm(
            {
              latitude: subscription.locationLatitude,
              longitude: subscription.locationLongitude,
            },
            { latitude: event.latitude, longitude: event.longitude },
          )
        : null;

    if (!matchesSubscription(subscription, alertEvent, distanceKm)) continue;

    const message = formatAlertMessage(alertEvent, { distanceKm });
    try {
      await sendChannelMessage(subscription.channel, subscription.target, message);
      sent += 1;
      logger.info(
        { channel: subscription.channel, key: event.eventKey },
        "notification_sent",
      );
    } catch (error) {
      logger.warn(
        { err: error, channel: subscription.channel },
        "notification_failed",
      );
    }
  }

  return sent;
}
