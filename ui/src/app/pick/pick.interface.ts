
import { IOdds } from '../models/odds.model';
import { IEventOdds } from '../models/event-odds.model';
import { IEvent } from '../models/event.model';

// Define the Event interface (same as in your pick.ts)


// This function merges odds into events to match the Event interface
export function normalizeOdds(odds: IOdds[], events: IEvent[]): IEventOdds[] {
  return events.map((event) => {
    // Find all odds for this event

    const eventOdds = odds.filter((odd: IOdds) => odd.eventId === event.id);

    // Group odds by bookmaker and market
    const bookmakersMap: Record<string, any> = {};
    eventOdds.forEach((odds: IOdds) => {
      if (!bookmakersMap[odds.bookmakerKey]) {
        bookmakersMap[odds.bookmakerKey] = {
          key: odds.bookmakerKey,
          title: odds.bookmakerTitle,
          markets: {},
        };
      }
      if (!bookmakersMap[odds.bookmakerKey].markets[odds.market]) {
        bookmakersMap[odds.bookmakerKey].markets[odds.market] = [];
      }
      bookmakersMap[odds.bookmakerKey].markets[odds.market].push({
        name: odds.team || odds.selection,
        price: odds.price,
        point: odds.line,
      });
    });

    // Convert to the expected structure
    const bookmakers = Object.values(bookmakersMap).map((bm: any) => ({
      key: String(bm.key),
      title: String(bm.title),
      markets: Object.entries(bm.markets).map(([marketKey, outcomes]) => ({
        key: marketKey,
        outcomes: outcomes as { name: string; price: number; point: number }[],
      })),
    }));

    return {
      id: event.id,
      sport_key: event.sport_key,
      sport_title: event.sport_title,
      commence_time: event.commence_time,
      home_team: event.home_team,
      away_team: event.away_team,
      bookmakers,
    };
  });
}
