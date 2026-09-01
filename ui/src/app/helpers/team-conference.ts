import { SportsEnum } from '../enums/sports.enum';

export type ConferenceOption = {
  id: string;
  label: string;
};

const NCAAF_CONFERENCES: ConferenceOption[] = [
  { id: 'sec', label: 'SEC' },
  { id: 'big_ten', label: 'Big Ten' },
  { id: 'big_12', label: 'Big 12' },
  { id: 'acc', label: 'ACC' },
  { id: 'pac_12', label: 'Pac-12' },
  { id: 'american', label: 'American' },
  { id: 'sun_belt', label: 'Sun Belt' },
  { id: 'mountain_west', label: 'Mountain West' },
  { id: 'mac', label: 'MAC' },
  { id: 'cusa', label: 'CUSA' },
  { id: 'independent', label: 'Independents' },
];

const NFL_CONFERENCES: ConferenceOption[] = [
  { id: 'afc', label: 'AFC' },
  { id: 'nfc', label: 'NFC' },
];

const NBA_CONFERENCES: ConferenceOption[] = [
  { id: 'east', label: 'Eastern' },
  { id: 'west', label: 'Western' },
];

const NCAAB_CONFERENCES: ConferenceOption[] = [
  { id: 'sec', label: 'SEC' },
  { id: 'big_ten', label: 'Big Ten' },
  { id: 'big_12', label: 'Big 12' },
  { id: 'acc', label: 'ACC' },
  { id: 'big_east', label: 'Big East' },
  { id: 'wcc', label: 'WCC' },
  { id: 'mountain_west', label: 'Mountain West' },
  { id: 'american', label: 'American' },
  { id: 'a10', label: 'Atlantic 10' },
];

const CONFERENCES_BY_SPORT: Record<string, ConferenceOption[]> = {
  [SportsEnum.NCAAF]: NCAAF_CONFERENCES,
  [SportsEnum.NFL]: NFL_CONFERENCES,
  [SportsEnum.NBA]: NBA_CONFERENCES,
  [SportsEnum.NCAAB]: NCAAB_CONFERENCES,
};

type TeamMaps = {
  exact: Record<string, string>;
};

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/&/g, '')
    .replace(/[().]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addTeams(
  maps: TeamMaps,
  conference: string,
  names: string[],
): void {
  for (const name of names) {
    const normalized = normalizeTeamName(name);
    if (!normalized) continue;
    maps.exact[normalized] = conference;
  }
}

function buildMaps(
  groups: { conference: string; names: string[] }[],
): TeamMaps {
  const maps: TeamMaps = { exact: {} };
  for (const group of groups) {
    addTeams(maps, group.conference, group.names);
  }
  return maps;
}

const NCAAF_MAPS = buildMaps([
  {
    conference: 'sec',
    names: [
      'Alabama Crimson Tide', 'Alabama',
      'Arkansas Razorbacks', 'Arkansas',
      'Auburn Tigers', 'Auburn',
      'Florida Gators', 'Florida',
      'Georgia Bulldogs', 'Georgia',
      'Kentucky Wildcats', 'Kentucky',
      'LSU Tigers', 'LSU', 'Louisiana State',
      'Mississippi State Bulldogs', 'Mississippi State',
      'Missouri Tigers', 'Missouri',
      'Ole Miss Rebels', 'Ole Miss', 'Ole Miss Rebels (Mississippi)',
      'South Carolina Gamecocks', 'South Carolina', 'South Carolina Gamecocks (SC)',
      'Tennessee Volunteers', 'Tennessee',
      'Texas Longhorns', 'Texas',
      'Texas A&M Aggies', 'Texas A&M', 'Texas AM',
      'Vanderbilt Commodores', 'Vanderbilt',
      'Oklahoma Sooners', 'Oklahoma',
    ],
  },
  {
    conference: 'big_ten',
    names: [
      'Illinois Fighting Illini', 'Illinois',
      'Indiana Hoosiers', 'Indiana',
      'Iowa Hawkeyes', 'Iowa',
      'Maryland Terrapins', 'Maryland',
      'Michigan Wolverines', 'Michigan',
      'Michigan State Spartans', 'Michigan State',
      'Minnesota Golden Gophers', 'Minnesota',
      'Nebraska Cornhuskers', 'Nebraska',
      'Northwestern Wildcats', 'Northwestern',
      'Ohio State Buckeyes', 'Ohio State',
      'Oregon Ducks', 'Oregon',
      'Penn State Nittany Lions', 'Penn State',
      'Purdue Boilermakers', 'Purdue',
      'Rutgers Scarlet Knights', 'Rutgers',
      'UCLA Bruins', 'UCLA',
      'USC Trojans', 'USC', 'Southern California',
      'Washington Huskies', 'Washington',
      'Wisconsin Badgers', 'Wisconsin',
    ],
  },
  {
    conference: 'big_12',
    names: [
      'Arizona Wildcats', 'Arizona',
      'Arizona State Sun Devils', 'Arizona State',
      'Baylor Bears', 'Baylor',
      'BYU Cougars', 'BYU', 'Brigham Young',
      'Cincinnati Bearcats', 'Cincinnati',
      'Colorado Buffaloes', 'Colorado',
      'Houston Cougars', 'Houston',
      'Iowa State Cyclones', 'Iowa State',
      'Kansas Jayhawks', 'Kansas',
      'Kansas State Wildcats', 'Kansas State',
      'Oklahoma State Cowboys', 'Oklahoma State',
      'TCU Horned Frogs', 'TCU',
      'Texas Tech Red Raiders', 'Texas Tech',
      'UCF Knights', 'UCF', 'Central Florida',
      'Utah Utes', 'Utah',
      'West Virginia Mountaineers', 'West Virginia',
    ],
  },
  {
    conference: 'acc',
    names: [
      'Boston College Eagles', 'Boston College',
      'California Golden Bears', 'California', 'Cal Golden Bears', 'Cal',
      'Clemson Tigers', 'Clemson',
      'Duke Blue Devils', 'Duke',
      'Florida State Seminoles', 'Florida State',
      'Georgia Tech Yellow Jackets', 'Georgia Tech',
      'Louisville Cardinals', 'Louisville',
      'Miami (FL) Hurricanes', 'Miami FL', 'Miami Florida', 'Miami Hurricanes',
      'North Carolina Tar Heels', 'North Carolina',
      'NC State Wolfpack', 'NC State', 'North Carolina State',
      'Pittsburgh Panthers', 'Pittsburgh', 'Pitt Panthers', 'Pitt',
      'SMU Mustangs', 'SMU',
      'Stanford Cardinal', 'Stanford',
      'Syracuse Orange', 'Syracuse',
      'Virginia Cavaliers', 'Virginia',
      'Virginia Tech Hokies', 'Virginia Tech',
      'Wake Forest Demon Deacons', 'Wake Forest',
    ],
  },
  {
    conference: 'pac_12',
    names: [
      'Boise State Broncos', 'Boise State',
      'Colorado State Rams', 'Colorado State',
      'Fresno State Bulldogs', 'Fresno State',
      'Oregon State Beavers', 'Oregon State',
      'San Diego State Aztecs', 'San Diego State',
      'Texas State Bobcats', 'Texas State',
      'Utah State Aggies', 'Utah State',
      'Washington State Cougars', 'Washington State',
    ],
  },
  {
    conference: 'american',
    names: [
      'Army Black Knights', 'Army',
      'Charlotte 49ers', 'Charlotte',
      'East Carolina Pirates', 'East Carolina',
      'Florida Atlantic Owls', 'Florida Atlantic',
      'Memphis Tigers', 'Memphis',
      'Navy Midshipmen', 'Navy',
      'North Texas Mean Green', 'North Texas',
      'Rice Owls', 'Rice',
      'Temple Owls', 'Temple',
      'Tulane Green Wave', 'Tulane',
      'Tulsa Golden Hurricane', 'Tulsa',
      'UAB Blazers', 'UAB',
      'South Florida Bulls', 'South Florida', 'USF',
      'UTSA Roadrunners', 'UTSA',
    ],
  },
  {
    conference: 'sun_belt',
    names: [
      'Appalachian State Mountaineers', 'Appalachian State', 'App State',
      'Arkansas State Red Wolves', 'Arkansas State',
      'Coastal Carolina Chanticleers', 'Coastal Carolina',
      'Georgia Southern Eagles', 'Georgia Southern',
      'Georgia State Panthers', 'Georgia State',
      'James Madison Dukes', 'James Madison',
      'Louisiana Ragin\' Cajuns', 'Louisiana Ragin Cajuns',
      'UL Lafayette Ragin\' Cajuns', 'Louisiana Lafayette Ragin\' Cajuns',
      'Louisiana',
      'Louisiana Tech Bulldogs', 'Louisiana Tech',
      'Marshall Thundering Herd', 'Marshall',
      'Old Dominion Monarchs', 'Old Dominion',
      'South Alabama Jaguars', 'South Alabama',
      'Southern Miss Golden Eagles', 'Southern Miss', 'Southern Mississippi',
      'Troy Trojans', 'Troy',
      'Louisiana-Monroe Warhawks', 'UL Monroe', 'Louisiana Monroe',
    ],
  },
  {
    conference: 'mountain_west',
    names: [
      'Air Force Falcons', 'Air Force',
      'Hawaii Rainbow Warriors', 'Hawaii', 'Hawai\'i',
      'Nevada Wolf Pack', 'Nevada',
      'New Mexico Lobos', 'New Mexico',
      'North Dakota State Bison', 'North Dakota State',
      'Northern Illinois Huskies', 'Northern Illinois',
      'San Jose State Spartans', 'San Jose State', 'San José State',
      'UNLV Rebels', 'UNLV',
      'UTEP Miners', 'UTEP',
      'Wyoming Cowboys', 'Wyoming',
    ],
  },
  {
    conference: 'mac',
    names: [
      'Akron Zips', 'Akron',
      'Ball State Cardinals', 'Ball State',
      'Bowling Green Falcons', 'Bowling Green',
      'Buffalo Bulls', 'Buffalo',
      'Central Michigan Chippewas', 'Central Michigan',
      'Eastern Michigan Eagles', 'Eastern Michigan',
      'Kent State Golden Flashes', 'Kent State',
      'Miami (OH) RedHawks', 'Miami OH', 'Miami Ohio', 'Miami (Ohio)',
      'Ohio Bobcats', 'Ohio',
      'Sacramento State Hornets', 'Sacramento State',
      'Toledo Rockets', 'Toledo',
      'UMass Minutemen', 'UMass', 'Massachusetts',
      'Western Michigan Broncos', 'Western Michigan',
    ],
  },
  {
    conference: 'cusa',
    names: [
      'Delaware Fightin\' Blue Hens', 'Delaware Blue Hens', 'Delaware',
      'FIU Panthers', 'FIU', 'Florida International',
      'Jacksonville State Gamecocks', 'Jacksonville State',
      'Kennesaw State Owls', 'Kennesaw State',
      'Liberty Flames', 'Liberty',
      'Middle Tennessee Blue Raiders', 'Middle Tennessee',
      'Missouri State Bears', 'Missouri State',
      'New Mexico State Aggies', 'New Mexico State',
      'Sam Houston Bearkats', 'Sam Houston',
      'Western Kentucky Hilltoppers', 'Western Kentucky',
    ],
  },
  {
    conference: 'independent',
    names: [
      'Notre Dame Fighting Irish', 'Notre Dame',
      'UConn Huskies', 'UConn', 'Connecticut',
    ],
  },
]);

const NFL_MAPS = buildMaps([
  {
    conference: 'afc',
    names: [
      'Baltimore Ravens',
      'Buffalo Bills',
      'Cincinnati Bengals',
      'Cleveland Browns',
      'Denver Broncos',
      'Houston Texans',
      'Indianapolis Colts',
      'Jacksonville Jaguars',
      'Kansas City Chiefs',
      'Las Vegas Raiders', 'Oakland Raiders',
      'Los Angeles Chargers', 'San Diego Chargers',
      'Miami Dolphins',
      'New England Patriots',
      'New York Jets',
      'Pittsburgh Steelers',
      'Tennessee Titans',
    ],
  },
  {
    conference: 'nfc',
    names: [
      'Arizona Cardinals',
      'Atlanta Falcons',
      'Carolina Panthers',
      'Chicago Bears',
      'Dallas Cowboys',
      'Detroit Lions',
      'Green Bay Packers',
      'Los Angeles Rams', 'St. Louis Rams',
      'Minnesota Vikings',
      'New Orleans Saints',
      'New York Giants',
      'Philadelphia Eagles',
      'San Francisco 49ers',
      'Seattle Seahawks',
      'Tampa Bay Buccaneers',
      'Washington Commanders',
    ],
  },
]);

const NBA_MAPS = buildMaps([
  {
    conference: 'east',
    names: [
      'Atlanta Hawks',
      'Boston Celtics',
      'Brooklyn Nets',
      'Charlotte Hornets',
      'Chicago Bulls',
      'Cleveland Cavaliers',
      'Detroit Pistons',
      'Indiana Pacers',
      'Miami Heat',
      'Milwaukee Bucks',
      'New York Knicks',
      'Orlando Magic',
      'Philadelphia 76ers',
      'Toronto Raptors',
      'Washington Wizards',
    ],
  },
  {
    conference: 'west',
    names: [
      'Dallas Mavericks',
      'Denver Nuggets',
      'Golden State Warriors',
      'Houston Rockets',
      'LA Clippers', 'Los Angeles Clippers',
      'Los Angeles Lakers',
      'Memphis Grizzlies',
      'Minnesota Timberwolves',
      'New Orleans Pelicans',
      'Oklahoma City Thunder',
      'Phoenix Suns',
      'Portland Trail Blazers',
      'Sacramento Kings',
      'San Antonio Spurs',
      'Utah Jazz',
    ],
  },
]);

const NCAAB_MAPS = buildMaps([
  {
    conference: 'sec',
    names: [
      'Alabama Crimson Tide', 'Alabama',
      'Arkansas Razorbacks', 'Arkansas',
      'Auburn Tigers', 'Auburn',
      'Florida Gators', 'Florida',
      'Georgia Bulldogs', 'Georgia',
      'Kentucky Wildcats', 'Kentucky',
      'LSU Tigers', 'LSU',
      'Mississippi State Bulldogs', 'Mississippi State',
      'Missouri Tigers', 'Missouri',
      'Ole Miss Rebels', 'Ole Miss',
      'Oklahoma Sooners', 'Oklahoma',
      'South Carolina Gamecocks', 'South Carolina',
      'Tennessee Volunteers', 'Tennessee',
      'Texas Longhorns', 'Texas',
      'Texas A&M Aggies', 'Texas A&M',
      'Vanderbilt Commodores', 'Vanderbilt',
    ],
  },
  {
    conference: 'big_ten',
    names: [
      'Illinois Fighting Illini', 'Illinois',
      'Indiana Hoosiers', 'Indiana',
      'Iowa Hawkeyes', 'Iowa',
      'Maryland Terrapins', 'Maryland',
      'Michigan Wolverines', 'Michigan',
      'Michigan State Spartans', 'Michigan State',
      'Minnesota Golden Gophers', 'Minnesota',
      'Nebraska Cornhuskers', 'Nebraska',
      'Northwestern Wildcats', 'Northwestern',
      'Ohio State Buckeyes', 'Ohio State',
      'Oregon Ducks', 'Oregon',
      'Penn State Nittany Lions', 'Penn State',
      'Purdue Boilermakers', 'Purdue',
      'Rutgers Scarlet Knights', 'Rutgers',
      'UCLA Bruins', 'UCLA',
      'USC Trojans', 'USC',
      'Washington Huskies', 'Washington',
      'Wisconsin Badgers', 'Wisconsin',
    ],
  },
  {
    conference: 'big_12',
    names: [
      'Arizona Wildcats', 'Arizona',
      'Arizona State Sun Devils', 'Arizona State',
      'Baylor Bears', 'Baylor',
      'BYU Cougars', 'BYU',
      'Cincinnati Bearcats', 'Cincinnati',
      'Colorado Buffaloes', 'Colorado',
      'Houston Cougars', 'Houston',
      'Iowa State Cyclones', 'Iowa State',
      'Kansas Jayhawks', 'Kansas',
      'Kansas State Wildcats', 'Kansas State',
      'Oklahoma State Cowboys', 'Oklahoma State',
      'TCU Horned Frogs', 'TCU',
      'Texas Tech Red Raiders', 'Texas Tech',
      'UCF Knights', 'UCF',
      'Utah Utes', 'Utah',
      'West Virginia Mountaineers', 'West Virginia',
    ],
  },
  {
    conference: 'acc',
    names: [
      'Boston College Eagles', 'Boston College',
      'California Golden Bears', 'California', 'Cal',
      'Clemson Tigers', 'Clemson',
      'Duke Blue Devils', 'Duke',
      'Florida State Seminoles', 'Florida State',
      'Georgia Tech Yellow Jackets', 'Georgia Tech',
      'Louisville Cardinals', 'Louisville',
      'Miami (FL) Hurricanes', 'Miami Hurricanes',
      'North Carolina Tar Heels', 'North Carolina',
      'NC State Wolfpack', 'NC State',
      'Notre Dame Fighting Irish', 'Notre Dame',
      'Pittsburgh Panthers', 'Pittsburgh',
      'SMU Mustangs', 'SMU',
      'Stanford Cardinal', 'Stanford',
      'Syracuse Orange', 'Syracuse',
      'Virginia Cavaliers', 'Virginia',
      'Virginia Tech Hokies', 'Virginia Tech',
      'Wake Forest Demon Deacons', 'Wake Forest',
    ],
  },
  {
    conference: 'big_east',
    names: [
      'Butler Bulldogs', 'Butler',
      'Creighton Bluejays', 'Creighton',
      'DePaul Blue Demons', 'DePaul',
      'Georgetown Hoyas', 'Georgetown',
      'Marquette Golden Eagles', 'Marquette',
      'Providence Friars', 'Providence',
      'St. John\'s Red Storm', 'St Johns',
      'Seton Hall Pirates', 'Seton Hall',
      'UConn Huskies', 'UConn', 'Connecticut',
      'Villanova Wildcats', 'Villanova',
      'Xavier Musketeers', 'Xavier',
    ],
  },
  {
    conference: 'wcc',
    names: [
      'Gonzaga Bulldogs', 'Gonzaga',
      'Saint Mary\'s Gaels', 'Saint Marys',
      'Santa Clara Broncos', 'Santa Clara',
      'San Francisco Dons', 'San Francisco',
    ],
  },
  {
    conference: 'mountain_west',
    names: [
      'Boise State Broncos', 'Boise State',
      'Colorado State Rams', 'Colorado State',
      'Fresno State Bulldogs', 'Fresno State',
      'Nevada Wolf Pack', 'Nevada',
      'New Mexico Lobos', 'New Mexico',
      'San Diego State Aztecs', 'San Diego State',
      'San Jose State Spartans', 'San Jose State',
      'UNLV Rebels', 'UNLV',
      'Utah State Aggies', 'Utah State',
      'Wyoming Cowboys', 'Wyoming',
    ],
  },
  {
    conference: 'american',
    names: [
      'Memphis Tigers', 'Memphis',
      'Tulane Green Wave', 'Tulane',
      'Wichita State Shockers', 'Wichita State',
      'South Florida Bulls', 'South Florida',
    ],
  },
  {
    conference: 'a10',
    names: [
      'Dayton Flyers', 'Dayton',
      'VCU Rams', 'VCU',
      'Saint Louis Billikens', 'Saint Louis',
      'George Mason Patriots', 'George Mason',
      'Rhode Island Rams', 'Rhode Island',
    ],
  },
]);

const MAPS_BY_SPORT: Record<string, TeamMaps> = {
  [SportsEnum.NCAAF]: NCAAF_MAPS,
  [SportsEnum.NFL]: NFL_MAPS,
  [SportsEnum.NBA]: NBA_MAPS,
  [SportsEnum.NCAAB]: NCAAB_MAPS,
};

export function getConferencesForSport(sportKey: string): ConferenceOption[] {
  return CONFERENCES_BY_SPORT[sportKey] ?? [];
}

export function getTeamConferenceId(
  teamName: string,
  sportKey: string,
): string | null {
  const maps = MAPS_BY_SPORT[sportKey];
  if (!maps || !teamName) return null;
  const normalized = normalizeTeamName(teamName);
  return maps.exact[normalized] ?? null;
}

export function getConferenceLabel(
  conferenceId: string | null | undefined,
  sportKey: string,
): string | null {
  if (!conferenceId) return null;
  return (
    getConferencesForSport(sportKey).find((option) => option.id === conferenceId)
      ?.label ?? null
  );
}

export function eventHasConference(
  event: { home_team: string; away_team: string },
  sportKey: string,
  conferenceId: string,
): boolean {
  return (
    getTeamConferenceId(event.home_team, sportKey) === conferenceId ||
    getTeamConferenceId(event.away_team, sportKey) === conferenceId
  );
}
