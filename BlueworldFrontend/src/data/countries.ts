/**
 * Reference list used by the CMS country picker. It is a dictionary of every
 * country and where to put its pin on the globe, NOT the list of countries
 * Blue World sells in: that list lives in the CMS (Country Showcase) and grows
 * whenever an admin picks a country from this dictionary.
 *
 * Coordinates are a representative city (usually the capital), good to well
 * under a degree, which is plenty for a pin on a globe.
 */
export interface Country {
  name: string;
  lat: number;
  lng: number;
  aliases: string[];
}

// [name, lat, lng, "alias, alias"]
const RAW: [string, number, number, string?][] = [
  // Africa
  ["Algeria", 36.75, 3.06],
  ["Angola", -8.84, 13.23],
  ["Benin Republic", 6.37, 2.43, "Benin, Republic of Benin"],
  ["Botswana", -24.65, 25.91],
  ["Burkina Faso", 12.37, -1.52],
  ["Burundi", -3.43, 29.93],
  ["Cabo Verde", 14.93, -23.51, "Cape Verde"],
  ["Cameroon", 3.85, 11.5],
  ["Central African Republic", 4.36, 18.56],
  ["Chad", 12.13, 15.06],
  ["Comoros", -11.7, 43.26],
  ["Congo (Republic)", -4.27, 15.28, "Congo-Brazzaville, Republic of the Congo"],
  ["DR Congo", -4.44, 15.27, "Democratic Republic of the Congo, Congo-Kinshasa, DRC"],
  ["Côte d'Ivoire", 5.36, -4.01, "Ivory Coast, Cote d'Ivoire"],
  ["Djibouti", 11.59, 43.15],
  ["Egypt", 30.04, 31.24],
  ["Equatorial Guinea", 3.75, 8.78],
  ["Eritrea", 15.34, 38.93],
  ["Eswatini", -26.31, 31.13, "Swaziland"],
  ["Ethiopia", 9.03, 38.74],
  ["Gabon", 0.39, 9.45],
  ["Gambia", 13.45, -16.58, "The Gambia"],
  ["Ghana", 5.6, -0.19],
  ["Guinea", 9.64, -13.58],
  ["Guinea-Bissau", 11.86, -15.6],
  ["Kenya", -1.2921, 36.8219],
  ["Lesotho", -29.31, 27.48],
  ["Liberia", 6.3, -10.8],
  ["Libya", 32.89, 13.19],
  ["Madagascar", -18.88, 47.51],
  ["Malawi", -13.98, 33.78],
  ["Mali", 12.64, -8.0],
  ["Mauritania", 18.08, -15.98],
  ["Mauritius", -20.16, 57.5],
  ["Morocco", 34.02, -6.84],
  ["Mozambique", -25.97, 32.57],
  ["Namibia", -22.56, 17.08],
  ["Niger", 13.51, 2.11],
  ["Nigeria", 9.082, 8.6753],
  ["Rwanda", -1.95, 30.06],
  ["São Tomé and Príncipe", 0.34, 6.73, "Sao Tome and Principe"],
  ["Senegal", 14.72, -17.47],
  ["Seychelles", -4.62, 55.45],
  ["Sierra Leone", 8.48, -13.23],
  ["Somalia", 2.05, 45.32],
  ["South Africa", -25.75, 28.19],
  ["South Sudan", 4.85, 31.58],
  ["Sudan", 15.5, 32.56],
  ["Tanzania", -6.16, 35.75],
  ["Togo", 6.13, 1.22],
  ["Tunisia", 36.81, 10.18],
  ["Uganda", 0.35, 32.58],
  ["Zambia", -15.39, 28.32],
  ["Zimbabwe", -17.83, 31.05],
  // Americas
  ["Antigua and Barbuda", 17.12, -61.85],
  ["Argentina", -34.6, -58.38],
  ["Bahamas", 25.05, -77.35],
  ["Barbados", 13.1, -59.61],
  ["Belize", 17.25, -88.77],
  ["Bolivia", -16.5, -68.15],
  ["Brazil", -15.79, -47.88],
  ["Canada", 45.42, -75.7],
  ["Chile", -33.45, -70.67],
  ["Colombia", 4.71, -74.07],
  ["Costa Rica", 9.93, -84.08],
  ["Cuba", 23.11, -82.37],
  ["Dominica", 15.3, -61.39],
  ["Dominican Republic", 18.49, -69.93],
  ["Ecuador", -0.18, -78.47],
  ["El Salvador", 13.69, -89.19],
  ["Grenada", 12.06, -61.75],
  ["Guatemala", 14.63, -90.51],
  ["Guyana", 6.8, -58.16],
  ["Haiti", 18.54, -72.34],
  ["Honduras", 14.07, -87.19],
  ["Jamaica", 18.0, -76.79],
  ["Mexico", 19.43, -99.13],
  ["Nicaragua", 12.13, -86.25],
  ["Panama", 8.98, -79.52],
  ["Paraguay", -25.26, -57.58],
  ["Peru", -12.05, -77.04],
  ["Saint Kitts and Nevis", 17.3, -62.72],
  ["Saint Lucia", 14.01, -60.99],
  ["Saint Vincent and the Grenadines", 13.16, -61.23],
  ["Suriname", 5.85, -55.2],
  ["Trinidad and Tobago", 10.66, -61.51],
  ["United States", 38.9, -77.04, "USA, US, America, United States of America"],
  ["Uruguay", -34.9, -56.19],
  ["Venezuela", 10.48, -66.9],
  // Europe
  ["Albania", 41.33, 19.82],
  ["Andorra", 42.51, 1.52],
  ["Austria", 48.21, 16.37],
  ["Belarus", 53.9, 27.57],
  ["Belgium", 50.85, 4.35],
  ["Bosnia and Herzegovina", 43.86, 18.41],
  ["Bulgaria", 42.7, 23.32],
  ["Croatia", 45.81, 15.98],
  ["Cyprus", 35.19, 33.38],
  ["Czechia", 50.08, 14.44, "Czech Republic"],
  ["Denmark", 55.68, 12.57],
  ["Estonia", 59.44, 24.75],
  ["Finland", 60.17, 24.94],
  ["France", 48.86, 2.35],
  ["Germany", 52.52, 13.4],
  ["Greece", 37.98, 23.73],
  ["Hungary", 47.5, 19.04],
  ["Iceland", 64.15, -21.94],
  ["Ireland", 53.35, -6.26],
  ["Italy", 41.9, 12.5],
  ["Latvia", 56.95, 24.11],
  ["Liechtenstein", 47.14, 9.52],
  ["Lithuania", 54.69, 25.28],
  ["Luxembourg", 49.61, 6.13],
  ["Malta", 35.9, 14.51],
  ["Moldova", 47.01, 28.86],
  ["Monaco", 43.74, 7.42],
  ["Montenegro", 42.44, 19.26],
  ["Netherlands", 52.37, 4.9, "Holland"],
  ["North Macedonia", 42.0, 21.43],
  ["Norway", 59.91, 10.75],
  ["Poland", 52.23, 21.01],
  ["Portugal", 38.72, -9.14],
  ["Romania", 44.43, 26.1],
  ["Russia", 55.76, 37.62],
  ["San Marino", 43.94, 12.45],
  ["Serbia", 44.79, 20.45],
  ["Slovakia", 48.15, 17.11],
  ["Slovenia", 46.06, 14.51],
  ["Spain", 40.42, -3.7],
  ["Sweden", 59.33, 18.07],
  ["Switzerland", 46.95, 7.45],
  ["Ukraine", 50.45, 30.52],
  ["United Kingdom", 51.51, -0.13, "UK, Britain, Great Britain, England"],
  ["Vatican City", 41.9, 12.45],
  // Asia
  ["Afghanistan", 34.53, 69.17],
  ["Armenia", 40.18, 44.51],
  ["Azerbaijan", 40.41, 49.87],
  ["Bahrain", 26.23, 50.59],
  ["Bangladesh", 23.81, 90.41],
  ["Bhutan", 27.47, 89.64],
  ["Brunei", 4.89, 114.94],
  ["Cambodia", 11.56, 104.93],
  ["China", 31.2304, 121.4737],
  ["Georgia", 41.72, 44.79],
  ["India", 19.076, 72.8777],
  ["Indonesia", -6.21, 106.85],
  ["Iran", 35.69, 51.39],
  ["Iraq", 33.31, 44.37],
  ["Israel", 31.77, 35.22],
  ["Japan", 35.68, 139.69],
  ["Jordan", 31.95, 35.93],
  ["Kazakhstan", 51.17, 71.45],
  ["Kuwait", 29.38, 47.99],
  ["Kyrgyzstan", 42.87, 74.59],
  ["Laos", 17.97, 102.6],
  ["Lebanon", 33.89, 35.5],
  ["Malaysia", 3.14, 101.69],
  ["Maldives", 4.18, 73.51],
  ["Mongolia", 47.89, 106.91],
  ["Myanmar", 19.76, 96.08, "Burma"],
  ["Nepal", 27.72, 85.32],
  ["North Korea", 39.04, 125.76],
  ["Oman", 23.59, 58.41],
  ["Pakistan", 33.68, 73.05],
  ["Philippines", 14.6, 120.98],
  ["Qatar", 25.29, 51.53],
  ["Saudi Arabia", 24.71, 46.68],
  ["Singapore", 1.35, 103.82],
  ["South Korea", 37.57, 126.98, "Korea"],
  ["Sri Lanka", 6.93, 79.86],
  ["Syria", 33.51, 36.29],
  ["Tajikistan", 38.56, 68.77],
  ["Thailand", 13.76, 100.5],
  ["Timor-Leste", -8.56, 125.57, "East Timor"],
  ["Turkey", 39.93, 32.86, "Türkiye, Turkiye"],
  ["Turkmenistan", 37.96, 58.33],
  ["United Arab Emirates", 25.2, 55.27, "UAE, Dubai"],
  ["Uzbekistan", 41.3, 69.24],
  ["Vietnam", 21.03, 105.85],
  ["Yemen", 15.37, 44.19],
  // Oceania
  ["Australia", -35.28, 149.13],
  ["Fiji", -18.14, 178.44],
  ["Kiribati", 1.33, 172.98],
  ["Marshall Islands", 7.09, 171.38],
  ["Micronesia", 6.92, 158.16],
  ["Nauru", -0.55, 166.92],
  ["New Zealand", -41.29, 174.78],
  ["Palau", 7.5, 134.62],
  ["Papua New Guinea", -9.44, 147.18],
  ["Samoa", -13.83, -171.76],
  ["Solomon Islands", -9.43, 159.95],
  ["Tonga", -21.14, -175.2],
  ["Tuvalu", -8.52, 179.2],
  ["Vanuatu", -17.73, 168.32],
];

export const COUNTRIES: Country[] = RAW.map(([name, lat, lng, aliases]) => ({
  name,
  lat,
  lng,
  aliases: aliases ? aliases.split(",").map((a) => a.trim()) : [],
})).sort((a, b) => a.name.localeCompare(b.name));

/** Lower-case, accent-free, for forgiving matching ("cote d'ivoire" finds "Côte d'Ivoire"). */
function norm(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const INDEX = new Map<string, Country>();
for (const c of COUNTRIES) {
  INDEX.set(norm(c.name), c);
  for (const a of c.aliases) INDEX.set(norm(a), c);
}

/** Looks a country up by its name or any alias, ignoring case and accents. */
export function findCountry(name: string | null | undefined): Country | null {
  if (!name) return null;
  return INDEX.get(norm(name)) ?? null;
}

/** Search for the picker: names that START with the text first, then names that merely contain it. */
export function searchCountries(query: string): Country[] {
  const q = norm(query);
  if (!q) return COUNTRIES;
  const starts: Country[] = [];
  const contains: Country[] = [];
  for (const c of COUNTRIES) {
    const keys = [norm(c.name), ...c.aliases.map(norm)];
    if (keys.some((k) => k.startsWith(q))) starts.push(c);
    else if (keys.some((k) => k.includes(q))) contains.push(c);
  }
  return [...starts, ...contains];
}