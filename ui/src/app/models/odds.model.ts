export interface IOdds {
  _id?: string;
  sport: string;
  eventId: string;
  commenceTime: string;
  bookmakerKey: string;
  bookmakerTitle: string;
  market: string;
  selection: string;
  team?: string;
  line: number | null;
  price: number;
  lastUpdate: string;
}
