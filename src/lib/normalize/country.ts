const ISO_CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );

const ALIASES: Record<string, string> = {
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  "united states of america": "US",
  america: "US",
  uk: "GB",
  "u.k.": "GB",
  britain: "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  uae: "AE",
  "south korea": "KR",
  "north korea": "KP",
  russia: "RU",
  iran: "IR",
  vietnam: "VN",
  "czech republic": "CZ",
  holland: "NL",
};

let nameIndex: Map<string, string> | null = null;

function index(): Map<string, string> {
  if (nameIndex) return nameIndex;
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  nameIndex = new Map<string, string>();
  for (const code of ISO_CODES) {
    const name = names.of(code);
    if (name) nameIndex.set(name.toLowerCase(), code);
    nameIndex.set(code.toLowerCase(), code);
  }
  for (const [alias, code] of Object.entries(ALIASES)) nameIndex.set(alias, code);
  return nameIndex;
}

/** Resolve a country name or ISO-3166-1 alpha-2 code to the code. Returns null when unknown. */
export function normalizeCountry(input: string | null | undefined): string | null {
  if (!input) return null;
  const key = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  return index().get(key) ?? null;
}
