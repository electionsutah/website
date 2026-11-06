import communityData from '../data/office-communities.json';
import partyProfiles from '../data/party-profiles.json';
import type { Office, Party, Place } from './entities';

export type Community = { name: string; placeId?: string; partial?: boolean };
export type EntityProfile = { description: string; sources: { label: string; url: string }[] };
export type OfficeProfile = EntityProfile & { scope: string; communities: Community[]; note: string; boundaryPeriod?: string };
type Member = { name: string; key: string; partial: boolean };
type Region = { municipalities: Member[]; counties: Member[] };
const regions = communityData.regions as Record<string, Region>;
const gis = { label: 'Utah GIS boundaries', url: 'https://gis.utah.gov/products/sgid/political/' };
const courts = { label: 'Utah judicial districts', url: 'https://www.utcourts.gov/en/about/miscellaneous/directory/map-of-judicial-districts.html' };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const municipalKey = (s: string) => slug(s).replace(/-(city|town|metro-township)$/, '');
const judicialCounties: Record<number, string[]> = {
  1: ['Box Elder', 'Cache', 'Rich'], 2: ['Davis', 'Morgan', 'Weber'],
  3: ['Salt Lake', 'Summit', 'Tooele'], 4: ['Juab', 'Millard', 'Utah', 'Wasatch'],
  5: ['Beaver', 'Iron', 'Washington'], 6: ['Garfield', 'Kane', 'Piute', 'Sanpete', 'Sevier', 'Wayne'],
  7: ['Carbon', 'Emery', 'Grand', 'San Juan'], 8: ['Daggett', 'Duchesne', 'Uintah']
};

/** Jurisdictions come from office titles and official boundaries, never filing addresses. */
export function officeProfile(office: Pick<Office, 'id' | 'name' | 'sections'>, places: Map<string, Place>): OfficeProfile {
  const { id, name } = office;
  const locate = (member: Member): Community => {
    const matches = [...places.values()].filter(p => p.type === 'City' && municipalKey(p.name) === municipalKey(member.name));
    // A municipality may have multiple county routes. Link only an unambiguous one.
    return { name: member.name, partial: member.partial, ...(matches.length === 1 ? { placeId: matches[0].id } : {}) };
  };
  const members = (region: Region) => region.municipalities.map(locate).sort((a,b) => a.name.localeCompare(b.name));
  const counties = Object.keys(regions).filter(k => k.startsWith('county/')).map(k => k.slice(7));
  const countyLinks = (keys: string[]): Community[] => keys.map(key => ({ name: places.get(key)?.name ?? `${key.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())} County`, ...(places.has(key) ? { placeId:key } : {}) }));
  const district = [
    [/^state-house-district-(\d+)(?:-|$)/, 'state-house', 'A seat in the Utah House of Representatives, which makes state laws and approves the state budget.'],
    [/^state-senate-district-(\d+)(?:-|$)/, 'state-senate', 'A seat in the Utah Senate, which makes state laws, approves the state budget, and considers appointments.'],
    [/^state-school-board-district-(\d+)(?:-|$)/, 'school-board', 'A seat on the Utah State Board of Education, which oversees the state’s public education system.'],
    [/^u-s-house-district-(\d+)(?:-|$)/, 'us-house', 'A seat in the U.S. House of Representatives, representing a Utah congressional district in federal lawmaking.']
  ] as const;
  for (const [pattern, layer, description] of district) {
    const match = id.match(pattern);
    if (!match) continue;
    const region = regions[`${layer}/${match[1]}`];
    const boundaryPeriod = layer === 'us-house' ? '2026–2032 boundaries' : '2022–2032 boundaries';
    return { description, scope: name, communities: region ? members(region) : [], boundaryPeriod,
      note: region ? `Includes all or part of ${region.counties.map(c=>c.name).join(', ')}. Municipalities below are estimated from boundary overlap; unincorporated areas are also served. These boundaries do not describe every historical filing year. Confirm address-level representation with the election office.` : 'This historical district has no corresponding boundary in the current district set. Its former communities have not yet been verified.',
      sources: [gis] };
  }
  const statewide: Record<string,string> = {
    'u-s-senate': 'A U.S. Senate seat representing all of Utah in federal lawmaking, treaties, and confirmations.',
    'governor-lieutenant-governor': 'Utah’s statewide executive ticket, headed by the governor, who leads the executive branch of state government.',
    'attorney-general': 'Utah’s chief legal officer, representing the state in legal matters.',
    'state-auditor': 'Utah’s statewide financial oversight office, auditing public funds and government accountability.',
    'state-treasurer': 'Utah’s statewide treasury office, responsible for state cash management and investments.'
  };
  if (statewide[id]) return { description:statewide[id],scope:'Statewide — Utah',communities:countyLinks(counties),note:'Serves residents throughout all 29 Utah counties.',sources:[{label:'Official office information',url:id==='u-s-senate'?'https://www.usa.gov/branches-of-government':'https://www.utah.gov/government/'}] };
  if (id === 'u-s-president-vice-president') return { description:'The national executive ticket: the president leads the federal executive branch and the vice president also presides over the U.S. Senate.',scope:'United States',communities:[],note:'Serves the entire country, including Utah. Utah filings are one part of a national election.',sources:[{label:'U.S. government branches',url:'https://www.usa.gov/branches-of-government'}] };
  if (office.sections.includes('State Judicial')) {
    const words = ['first','second','third','fourth','fifth','sixth','seventh','eighth'];
    const ordinal = name.toLowerCase().match(/\b([1-8])(?:st|nd|rd|th)\b/);
    const n = ordinal ? +ordinal[1] : words.findIndex(w=>new RegExp(`\\b${w}\\b`,'i').test(name))+1;
    const appellate = /supreme|appeals/i.test(name);
    return { description: /juvenile/i.test(name) ? 'A Utah juvenile court judgeship hearing matters involving children and families within its jurisdiction.' : appellate ? 'A Utah appellate judgeship reviewing lower-court decisions and questions of law.' : 'A Utah district court judgeship hearing civil and criminal cases within its jurisdiction.',scope:appellate?'Statewide — Utah':n?`Judicial District ${n}`:name,
      communities:countyLinks(appellate?counties:(judicialCounties[n]??[]).map(slug)), note:'Judges serve the court’s jurisdiction and appear in nonpartisan retention elections; they do not represent political constituencies.',sources:[courts] };
  }
  const county = name.match(/^(.+?) County (.+)$/);
  if (office.sections.includes('County office') && county) {
    const key = slug(county[1]), role = county[2];
    const divided = /(?:council|commission).*district|council(?!.*at large)|commission seat \d/i.test(role);
    const duties: [RegExp, string][] = [
      [/assessor/i, 'values property for taxation'], [/recorder/i, 'maintains land and property records'],
      [/treasurer/i, 'collects and manages county tax receipts'], [/clerk/i, 'maintains county records and administers elections'],
      [/auditor|controller/i, 'oversees county financial records and accountability'], [/sheriff/i, 'leads the county sheriff’s office'],
      [/attorney/i, 'handles the county’s legal affairs and criminal prosecutions'], [/surveyor/i, 'maintains county survey records'], [/executive/i, 'leads the county executive administration']
    ];
    const functions = duties.filter(([pattern])=>pattern.test(role)).map(([,duty])=>duty);
    const description = /council|commission/i.test(role) ? `A seat on ${county[1]} County’s governing body, which sets county policy and budgets.` : functions.length ? `An elected ${county[1]} County office that ${functions.join(' and ')}.` : `The ${role.replace(/\s*\([^)]*\)/g,'').toLowerCase()} office in ${county[1]} County government.`;
    return {description,scope:divided?name:`${county[1]} County`,communities:divided?[]:members(regions[`county/${key}`]??{municipalities:[],counties:[]}),note:divided?'This seat is associated with a county subdivision. Its exact electoral boundary and communities have not yet been verified.':'Serves the county, including its municipalities and unincorporated areas. Listed municipalities are identified by geographic overlap; individual services may have different coverage.',sources:[gis]};
  }
  if (office.sections.includes('Municipal office')) {
    // Longest municipal title prefix wins: West Valley City before West Valley.
    const match = communityData.municipalities.filter(m => {
      const title = municipalKey(m.name);
      return id === title || id.startsWith(title+'-') || id.startsWith('town-of-'+title);
    }).sort((a,b)=>b.key.length-a.key.length)[0];
    const divided = /\bdistrict\b|\bseat\b(?!.*at large)/i.test(name) && !/at large/i.test(name);
    const description = /mayor/i.test(name) ? `The elected mayor of ${match?.name??name.replace(/ Mayor.*$/,'')}, serving in municipal government.` : `An elected seat in ${match?.name??name.replace(/ Council.*$/,'')} municipal government.`;
    return {description,scope:match?`${match.name}${divided?' — council subdivision':''}`:name,communities:match?[locate({name:match.name,key:match.key,partial:divided})]:[],note:!match?'The municipality’s boundary has not yet been matched to the current GIS data.':divided?'Represents part of this municipality. The exact ward or seat boundary has not yet been verified.':'Serves the municipality. Named-seat election arrangements should be confirmed with the municipal clerk.',sources:[{label:'Utah municipal boundaries',url:'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/UtahMunicipalBoundaries/FeatureServer/0'}]};
  }
  if (office.sections.includes('School Board Offices')) {
    const districtName=name.replace(/ School Board.*$/,'');
    return {description:`An elected seat on the ${districtName} school board, which governs its local public school district.`,scope:name,communities:[],note:'Serves the school-board electoral area within the named school district. School boundaries may cross city and county lines; the seat’s exact communities have not yet been verified.',sources:[{label:'Utah school district boundaries',url:'https://gis.utah.gov/products/sgid/boundaries/school-districts/'}]};
  }
  return {description:`An elected position serving the ${name.replace(/\s+(?:Board Member|Board of Trustees|Trustee).*$/i,'')} service area.`,scope:name,communities:[],note:'This special-purpose district’s service and electoral boundaries have not yet been verified. Its name alone does not establish which communities are included.',sources:[]};
}

export function partyProfile(party: Pick<Party, 'id'>): EntityProfile {
  return (partyProfiles as Record<string, EntityProfile>)[party.id] ?? {description:'A political affiliation recorded in the Utah election archive.',sources:[]};
}
