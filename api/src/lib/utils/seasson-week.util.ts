export function getCurrentSeasonAndWeek(): { season: number; week: number } {
  const now = new Date();
  // Example: NFL season starts in September and ends in February
  // Adjust logic as needed for your league's calendar
  let season = now.getFullYear();
  if (now.getMonth() < 6) {
    // Before July, still previous season (playoffs)
    season = season - 1;
  }
  // Example: NFL regular season usually starts around week 36 (early September)
  const seasonStart = new Date(season, 8, 1); // September 1st
  const diff = now.getTime() - seasonStart.getTime();
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 2;
  return { season, week };
}
