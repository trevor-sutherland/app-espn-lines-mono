export interface IBookmakers {
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
}