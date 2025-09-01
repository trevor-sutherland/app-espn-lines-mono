/* eslint-disable @typescript-eslint/no-explicit-any */
import { eventNflMock } from '../mocks/eventNfl.mock';
import { eventNcaafMock } from '../mocks/eventNcaaf.mock';
import { oddsNflMock } from '../mocks/oddsNfl.mock';
import { oddsNcaafMock } from '../mocks/oddsNcaaf.mock';

// Define the Event interface (same as in your pick.ts)
export interface Event {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: {
    key: string;
    title: string;
    markets: {
      key: string;
      outcomes: {
        name: string;
        price: number;
        point: number;
      }[];
    }[];
  }[];
}

// This function merges odds into events to match the Event interface
export function normalizeMocks(sportKey: string): Event[] {
  const eventMock = sportKey === 'americanfootball_nfl' ? eventNflMock : eventNcaafMock;
  return eventMock.map((event) => {
    // Find all odds for this event

    const oddsMock = sportKey === 'americanfootball_nfl' ? oddsNflMock : oddsNcaafMock;
    const eventOdds = oddsMock.filter((odds: any) => odds.eventId === event.id);

    // Group odds by bookmaker and market
    const bookmakersMap: Record<string, any> = {};
    eventOdds.forEach((odds: any) => {
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
