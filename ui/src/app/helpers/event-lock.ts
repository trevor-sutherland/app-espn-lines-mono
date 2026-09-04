/**
 * Kickoff lock: a game is closed for picks at commence time.
 * Missing/invalid commence fails closed so a stale row cannot stay pickable.
 */
export function eventHasStarted(
  commenceTime: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (commenceTime == null || commenceTime === '') {
    return true;
  }
  const kickoff = new Date(commenceTime).getTime();
  if (!Number.isFinite(kickoff)) {
    return true;
  }
  return now.getTime() >= kickoff;
}
