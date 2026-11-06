import type { Filing, Person, Office, Party, Place } from './entities';
import type { EditorialData } from './editorial';

export type Structure = { people: Pick<Person, 'id' | 'name'>[]; offices: Pick<Office, 'id' | 'name'>[]; parties: Pick<Party, 'id' | 'name'>[]; places: Pick<Place, 'id' | 'name' | 'type' | 'parentId' | 'county'>[]; filings?: { id?: string; recordId?: string; personId: string; runningMateId: string; year?: number }[] };
export const structuralPaths = ['name', 'year', 'personId', 'runningMateId', 'officeId', 'partyId', 'placeId', 'placeIds', 'parentId'];

export function validateStructure(data: Structure, saved: EditorialData) {
  const lookup = { people: new Map(data.people.map(row => [row.id, row])), offices: new Map(data.offices.map(row => [row.id, row])), parties: new Map(data.parties.map(row => [row.id, row])), places: new Map(data.places.map(row => [row.id, row])) };
  const requireId = (kind: keyof typeof lookup, value: unknown) => { if (typeof value !== 'string' || !lookup[kind].has(value)) throw new Error(`Unknown ${kind} reference: ${value}`); };
  const years = new Set(data.filings?.map(row => row.year));
  for (const filing of data.filings ?? []) {
    const changes = saved.filings[filing.recordId ?? filing.id ?? ''] ?? {};
    const personId = changes.personId ?? filing.personId;
    const mateId = changes.runningMateId ?? filing.runningMateId;
    if (mateId && mateId === personId) throw new Error('A candidate cannot be their own running mate');
  }
  for (const [kind, entries] of Object.entries(saved).filter(([key]) => key !== 'version')) {
    for (const [id, changes] of Object.entries(entries ?? {}) as [string, Record<string, unknown>][]) {
      if ('name' in changes && (typeof changes.name !== 'string' || !changes.name.trim())) throw new Error('Entity names cannot be empty');
      if ('year' in changes && !years.has(changes.year as number)) throw new Error('Choose an existing election year');
      for (const [path, target] of [['personId', 'people'], ['runningMateId', 'people'], ['officeId', 'offices'], ['partyId', 'parties'], ['placeId', 'places']] as const) {
        if (path in changes && !(changes[path] === '' && ['runningMateId', 'placeId'].includes(path))) requireId(target, changes[path]);
      }
      if ('placeIds' in changes) {
        if (!Array.isArray(changes.placeIds)) throw new Error('Office places must be a list');
        for (const place of changes.placeIds) requireId('places', place);
      }
      if (kind === 'places' && 'parentId' in changes) {
        const place = lookup.places.get(id);
        const parent = lookup.places.get(changes.parentId as string);
        if (!place || place.type !== 'City' || parent?.type !== 'County') throw new Error('A city must belong to an existing county; counties cannot be reparented');
      }
    }
  }
}

/** Mutate the shared directory objects only after validation; IDs and source records stay fixed. */
export function applyStructure(data: { people: Person[]; offices: Office[]; parties: Party[]; places: Place[]; filings: Filing[] }, saved: EditorialData) {
  validateStructure(data, saved);
  if (!Object.entries(saved).some(([kind, entries]) => kind !== 'version' && Object.values(entries ?? {}).some(changes => Object.keys(changes as object).some(key => structuralPaths.includes(key))))) return;
  const people = new Map(data.people.map(row => [row.id, row]));
  const offices = new Map(data.offices.map(row => [row.id, row]));
  const parties = new Map(data.parties.map(row => [row.id, row]));
  const places = new Map(data.places.map(row => [row.id, row]));
  const officeSections = new Map(data.offices.map(row => [row.id, row.filings[0]?.section]));
  const partyRawNames = new Map(data.parties.map(row => [row.id, row.filings[0]?.rawParty]));
  for (const kind of ['people', 'offices', 'parties', 'places'] as const) for (const row of data[kind]) {
    const name = saved[kind]?.[row.id]?.name;
    if (typeof name === 'string') row.name = name.trim();
  }
  for (const person of data.people) { person.filings = []; person.years = []; person.initials = person.name.split(/\s+/).slice(0, 2).map(part => part[0]).join(''); }
  for (const office of data.offices) { office.filings = []; office.years = []; office.placeIds = []; }
  for (const party of data.parties) { party.filings = []; party.years = []; }
  for (const place of data.places) {
    const parentId = saved.places?.[place.id]?.parentId;
    if (typeof parentId === 'string') { place.parentId = parentId; place.county = places.get(parentId)!.name.replace(/ County$/, ''); }
    if (place.type === 'County') place.county = place.name.replace(/ County$/, '');
    else if (places.has(place.parentId)) place.county = places.get(place.parentId)!.name.replace(/ County$/, '');
    place.filings = []; place.offices = []; place.children = []; place.years = [];
  }
  for (const filing of data.filings) {
    const changes = saved.filings[filing.recordId] ?? {};
    if (typeof changes.year === 'number') filing.year = changes.year;
    for (const key of ['personId', 'runningMateId', 'officeId', 'partyId'] as const) if (typeof changes[key] === 'string') filing[key] = changes[key];
    if (filing.runningMateId && filing.runningMateId === filing.personId) throw new Error('A candidate cannot be their own running mate');
    if ('personId' in changes) filing.name = people.get(filing.personId)!.name;
    if ('runningMateId' in changes) filing.runningMate = filing.runningMateId ? people.get(filing.runningMateId)!.name : '';
    filing.officeName = offices.get(filing.officeId)!.name;
    filing.partyName = parties.get(filing.partyId)!.name;
    if ('officeId' in changes) filing.section = officeSections.get(filing.officeId) ?? filing.section;
    if ('partyId' in changes) filing.rawParty = partyRawNames.get(filing.partyId) ?? filing.rawParty;
    if ('placeId' in changes) {
      const place = places.get(changes.placeId as string);
      filing.city = place?.type === 'City' ? place.name : '';
      filing.county = place?.county ?? '';
      filing.placeIds = place ? [...(place.parentId ? [place.parentId] : []), place.id] : [];
    }
    const linkedCity = filing.placeIds.map(id => places.get(id)).find(place => place?.type === 'City');
    const linkedCounty = filing.placeIds.map(id => places.get(id)).find(place => place?.type === 'County');
    if (linkedCity) { filing.city = linkedCity.name; filing.county = linkedCity.county; filing.placeIds = [linkedCity.parentId, linkedCity.id].filter(Boolean); }
    else if (linkedCounty) filing.county = linkedCounty.county;
    for (const id of new Set([filing.personId, filing.runningMateId].filter(Boolean))) people.get(id)!.filings.push(filing);
    offices.get(filing.officeId)!.filings.push(filing);
    parties.get(filing.partyId)!.filings.push(filing);
    for (const id of filing.placeIds) { const place = places.get(id); if (place) { place.filings.push(filing); if (!place.offices.includes(offices.get(filing.officeId)!)) place.offices.push(offices.get(filing.officeId)!); } }
  }
  for (const kind of ['people', 'offices', 'parties', 'places'] as const) for (const row of data[kind]) {
    row.filings.sort((a,b) => b.year - a.year || a.name.localeCompare(b.name));
    row.years = [...new Set(row.filings.map(filing => filing.year))].sort((a,b) => b-a);
  }
  for (const office of data.offices) {
    office.sections = [...new Set(office.filings.map(filing => filing.section.replace(/^(\w+) Offices$/, '$1 office')))];
    office.placeIds = (saved.offices?.[office.id]?.placeIds as string[] | undefined) ?? [...new Set(office.filings.flatMap(filing => filing.placeIds))];
    for (const id of office.placeIds) if (places.has(id) && !places.get(id)!.offices.includes(office)) places.get(id)!.offices.push(office);
  }
  for (const place of data.places) if (place.parentId) places.get(place.parentId)?.children.push(place);
  for (const kind of ['people', 'offices', 'parties', 'places'] as const) data[kind].sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
