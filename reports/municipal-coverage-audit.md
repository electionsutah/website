# Municipal coverage audit

Reference: [UGRC municipality boundaries](https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/UtahMunicipalBoundaries/FeatureServer/0/query). Existing UGRC municipality boundary snapshot used by the local-contest importer; a current-boundary reference, not a historical incorporation timeline. Not every municipality necessarily held an election in each audited year.

Audited 257 distinct municipalities across 261 municipality/county boundary entries. Multi-county municipalities are counted once. 0 have no place page; 9 have no municipal candidate records.

These are coverage flags, not proof that elections were held or that no candidates filed. Incorporation dates, uncontested cancellations, and missing source rosters need individual review.

| Election year | Municipalities with records | No records |
| --- | ---: | ---: |
| 2013 | 16 | 241 |
| 2015 | 16 | 241 |
| 2017 | 24 | 233 |
| 2019 | 6 | 251 |
| 2021 | 1 | 256 |
| 2023 | 175 | 82 |
| 2025 | 214 | 43 |

## Municipalities without candidate records

- [Fielding](https://www.electionsutah.org/places/box-elder/fielding/), [Box Elder County](https://www.electionsutah.org/places/box-elder/) (place page exists)
- [Cornish](https://www.electionsutah.org/places/cache/cornish/), [Cache County](https://www.electionsutah.org/places/cache/) (place page exists)
- [Clawson](https://www.electionsutah.org/places/emery/clawson/), [Emery County](https://www.electionsutah.org/places/emery/) (place page exists)
- [Elmo](https://www.electionsutah.org/places/emery/elmo/), [Emery County](https://www.electionsutah.org/places/emery/) (place page exists)
- [Antimony](https://www.electionsutah.org/places/garfield/antimony/), [Garfield County](https://www.electionsutah.org/places/garfield/) (place page exists)
- [Alton](https://www.electionsutah.org/places/kane/alton/), [Kane County](https://www.electionsutah.org/places/kane/) (place page exists)
- [Lynndyl](https://www.electionsutah.org/places/millard/lynndyl/), [Millard County](https://www.electionsutah.org/places/millard/) (place page exists)
- [Scipio](https://www.electionsutah.org/places/millard/scipio/), [Millard County](https://www.electionsutah.org/places/millard/) (place page exists)
- [Kingston](https://www.electionsutah.org/places/piute/kingston/), [Piute County](https://www.electionsutah.org/places/piute/) (place page exists)

## Investigation of the original 33 gaps

Each municipality received a source review. Imports add the supported records only; they do not establish a complete roster across all years. Named cancellations, filing lists, and signed canvasses are importable. Incumbent lists, prospective filing notices, vacancy appointments, and proposed cancellation agendas are not candidate rosters.

### [Corinne](https://www.electionsutah.org/places/box-elder/corinne/), [Box Elder County](https://www.electionsutah.org/places/box-elder/)

Status: Candidate records imported. Imported records: 2.

- The October 2025 cancellation notice names two candidates elected unopposed. It does not establish a full historical roster.
- [Shane D. Baton](https://www.electionsutah.org/people/shane-d-baton/) · 2025 · [Corinne Mayor](https://www.electionsutah.org/offices/corinne-mayor/) · Elected unopposed; election cancelled
- [Krista K. Hardman](https://www.electionsutah.org/people/krista-k-hardman/) · 2025 · [Corinne City Council](https://www.electionsutah.org/offices/corinne-city-council/) · Elected unopposed; election cancelled
- [Source 1](https://www.utah.gov/pmn/sitemap/notice/1028863.html)

### [Fielding](https://www.electionsutah.org/places/box-elder/fielding/), [Box Elder County](https://www.electionsutah.org/places/box-elder/)

Status: Cancellation proposed; roster unresolved. Imported records: 0.

- Official notice proposes Resolution 10-02-25 to cancel the election because candidates do not exceed seats. Need adopted resolution/minutes and a named candidate list.
- [Source 1](https://www.utah.gov/pmn/sitemap/notice/1024615.html)

### [Portage](https://www.electionsutah.org/places/box-elder/portage/), [Box Elder County](https://www.electionsutah.org/places/box-elder/)

Status: Candidate records imported. Imported records: 1.

- The current revision of the June filing notice names Max K. Huggins for mayor. No council names are listed; no later outcome inferred.
- [Max K. Huggins](https://www.electionsutah.org/people/max-k-huggins/) · 2025 · [Portage Mayor](https://www.electionsutah.org/offices/portage-mayor/) · Filed
- [Source 1](https://www.utah.gov/pmn/sitemap/notice/1001569.html)

### [Snowville](https://www.electionsutah.org/places/box-elder/snowville/), [Box Elder County](https://www.electionsutah.org/places/box-elder/)

Status: Candidate records imported. Imported records: 5.

- The adopted October 10 cancellation resolution names the mayor and three council candidates elected without a ballot.
- The county publication ballot also explicitly marks Orlando Scott Ohare as withdrawn from the mayoral race; his candidacy is retained with withdrawn status.
- [James D. Beagley](https://www.electionsutah.org/people/james-d-beagley/) · 2025 · [Snowville Mayor](https://www.electionsutah.org/offices/snowville-mayor/) · Elected unopposed; election cancelled
- [Trisha A. Arbon](https://www.electionsutah.org/people/trisha-a-arbon/) · 2025 · [Snowville Town Council](https://www.electionsutah.org/offices/snowville-town-council/) · Elected unopposed; election cancelled
- [Brandon B. Garbanati](https://www.electionsutah.org/people/brandon-b-garbanati/) · 2025 · [Snowville Town Council](https://www.electionsutah.org/offices/snowville-town-council/) · Elected unopposed; election cancelled
- [LuAnn Johnson](https://www.electionsutah.org/people/luann-johnson/) · 2025 · [Snowville Town Council (2-Year Term)](https://www.electionsutah.org/offices/snowville-town-council-2-year-term/) · Elected unopposed; election cancelled
- [Orlando Scott Ohare](https://www.electionsutah.org/people/orlando-scott-ohare/) · 2025 · [Snowville Mayor](https://www.electionsutah.org/offices/snowville-mayor/) · Withdrew
- [Source 1](https://www.utah.gov/pmn/files/1334165.pdf)
- [Source 2](https://www.utah.gov/pmn/files/1338227.pdf)

### [Cornish](https://www.electionsutah.org/places/cache/cornish/), [Cache County](https://www.electionsutah.org/places/cache/)

Status: Cancellation lead; primary source unresolved. Imported records: 0.

- Secondary meeting index reports a 2025 cancellation and three named candidates. Need the original cancellation resolution or county filings before import. The candidate guide lists incumbents only.
- [Source 1](https://mytown.theboringparts.com/city/ut-pmn-110/2025/)

### [River Heights](https://www.electionsutah.org/places/cache/river-heights/), [Cache County](https://www.electionsutah.org/places/cache/)

Status: Candidate records imported. Imported records: 4.

- Adopted Resolution 6-2025 cancels the November election and names the mayor and three council candidates elected.
- [Blake Wright](https://www.electionsutah.org/people/blake-wright/) · 2025 · [River Heights Mayor](https://www.electionsutah.org/offices/river-heights-mayor/) · Elected unopposed; election cancelled
- [Kandi Evans](https://www.electionsutah.org/people/kandi-evans/) · 2025 · [River Heights City Council](https://www.electionsutah.org/offices/river-heights-city-council/) · Elected unopposed; election cancelled
- [Janet Mathews](https://www.electionsutah.org/people/janet-mathews/) · 2025 · [River Heights City Council](https://www.electionsutah.org/offices/river-heights-city-council/) · Elected unopposed; election cancelled
- [Mark Malmstrom](https://www.electionsutah.org/people/mark-malmstrom/) · 2025 · [River Heights City Council (2-Year Term)](https://www.electionsutah.org/offices/river-heights-city-council-2-year-term/) · Elected unopposed; election cancelled
- [Source 1](https://riverheights.gov/wp-content/uploads/2025/11/Minutes-Council-Oct-7-2025.pdf)

### [South Weber](https://www.electionsutah.org/places/davis/south-weber/), [Davis County](https://www.electionsutah.org/places/davis/)

Status: Candidate records imported. Imported records: 3.

- The city election page declares the mayor and two council candidates elected following cancellation.
- [Rod Westbroek](https://www.electionsutah.org/people/rod-westbroek/) · 2025 · [South Weber Mayor](https://www.electionsutah.org/offices/south-weber-mayor/) · Elected unopposed; election cancelled
- [Angie Petty](https://www.electionsutah.org/people/angie-petty/) · 2025 · [South Weber City Council](https://www.electionsutah.org/offices/south-weber-city-council/) · Elected unopposed; election cancelled
- [Joel Dills](https://www.electionsutah.org/people/joel-dills/) · 2025 · [South Weber City Council](https://www.electionsutah.org/offices/south-weber-city-council/) · Elected unopposed; election cancelled
- [Source 1](https://southwebercity.gov/government/elections/)

### [Altamont](https://www.electionsutah.org/places/duchesne/altamont/), [Duchesne County](https://www.electionsutah.org/places/duchesne/)

Status: Candidate records imported. Imported records: 5.

- The town publishes five certified ballot candidates and unofficial 2025 totals. Imported candidate participation only, without winner status or vote totals.
- [Philip Scott Allen](https://www.electionsutah.org/people/philip-scott-allen/) · 2025 · [Altamont Mayor](https://www.electionsutah.org/offices/altamont-mayor/) · General Election Candidate
- [Michael Howard Foy](https://www.electionsutah.org/people/michael-howard-foy/) · 2025 · [Altamont Town Council](https://www.electionsutah.org/offices/altamont-town-council/) · General Election Candidate
- [James Edward Helms](https://www.electionsutah.org/people/james-edward-helms/) · 2025 · [Altamont Town Council](https://www.electionsutah.org/offices/altamont-town-council/) · General Election Candidate
- [Christopher David Baca](https://www.electionsutah.org/people/christopher-david-baca/) · 2025 · [Altamont Town Council (2-Year Term)](https://www.electionsutah.org/offices/altamont-town-council-2-year-term/) · General Election Candidate
- [Russell Roy Sorensen](https://www.electionsutah.org/people/russell-roy-sorensen/) · 2025 · [Altamont Town Council (2-Year Term)](https://www.electionsutah.org/offices/altamont-town-council-2-year-term/) · General Election Candidate
- [Source 1](https://altamontutah.gov/elections)

### [Myton](https://www.electionsutah.org/places/duchesne/myton/), [Duchesne County](https://www.electionsutah.org/places/duchesne/)

Status: Candidate records imported. Imported records: 7.

- The city publishes a certified 2025 primary canvass with five council candidates and four advancing to the general election. The filing notice also names two mayoral candidates. Later general-election outcomes remain to be verified.
- [Herald J Crapo](https://www.electionsutah.org/people/herald-j-crapo/) · 2025 · [Myton City Council](https://www.electionsutah.org/offices/myton-city-council/) · Certified for general election
- [Wilford Conetah](https://www.electionsutah.org/people/wilford-conetah/) · 2025 · [Myton City Council](https://www.electionsutah.org/offices/myton-city-council/) · Certified for general election
- [Sherri Stoddard](https://www.electionsutah.org/people/sherri-stoddard/) · 2025 · [Myton City Council](https://www.electionsutah.org/offices/myton-city-council/) · Certified for general election
- [Michael “Chipper” Morris Fenn](https://www.electionsutah.org/people/michael-chipper-morris-fenn/) · 2025 · [Myton City Council](https://www.electionsutah.org/offices/myton-city-council/) · Certified for general election
- [Kari Jean Smith](https://www.electionsutah.org/people/kari-jean-smith/) · 2025 · [Myton City Council](https://www.electionsutah.org/offices/myton-city-council/) · Not advancing from primary
- [Kathleen L Cooper](https://www.electionsutah.org/people/kathleen-l-cooper/) · 2025 · [Myton Mayor](https://www.electionsutah.org/offices/myton-mayor/) · Filed
- [Linda Harrington](https://www.electionsutah.org/people/linda-harrington/) · 2025 · [Myton Mayor](https://www.electionsutah.org/offices/myton-mayor/) · Filed
- [Source 1](https://www.mytoncityut.gov/wp-content/uploads/2025/08/OFFICIAL-CERTIFIED-MUNICIPAL-PRIMARY-ELECTION-RESULTS.pdf)
- [Source 2](https://www.mytoncityut.gov/wp-content/uploads/2025/06/Election-Public-Notice-for-candidates.pdf)

### [Clawson](https://www.electionsutah.org/places/emery/clawson/), [Emery County](https://www.electionsutah.org/places/emery/)

Status: Cancellation proposed; roster unresolved. Imported records: 0.

- September 11 agenda lists approval of cancellation resolution 2025002. An agenda alone does not prove adoption; obtain minutes or resolution and candidate names.
- [Source 1](https://www.utah.gov/pmn/sitemap/notice/1021915.html)

### [Cleveland](https://www.electionsutah.org/places/emery/cleveland/), [Emery County](https://www.electionsutah.org/places/emery/)

Status: Candidate records imported. Imported records: 3.

- Visually verified the official notice naming Shawna Horrocks, Whitney Guymon and Kristen Vose elected after the September 2025 cancellation. The notice contains a county template typo; the publishing public body and town address identify Cleveland in Emery County.
- [Shawna Horrocks](https://www.electionsutah.org/people/shawna-horrocks/) · 2025 · [Cleveland Mayor](https://www.electionsutah.org/offices/cleveland-mayor/) · Elected unopposed; election cancelled
- [Whitney Guymon](https://www.electionsutah.org/people/whitney-guymon/) · 2025 · [Cleveland Town Council](https://www.electionsutah.org/offices/cleveland-town-council/) · Elected unopposed; election cancelled
- [Kristen Vose](https://www.electionsutah.org/people/kristen-vose/) · 2025 · [Cleveland Town Council](https://www.electionsutah.org/offices/cleveland-town-council/) · Elected unopposed; election cancelled
- [Source 1](https://www.utah.gov/pmn/sitemap/notice/1022376.html)
- [Source 2](https://www.utah.gov/pmn/files/1322142.pdf)

### [Elmo](https://www.electionsutah.org/places/emery/elmo/), [Emery County](https://www.electionsutah.org/places/emery/)

Status: Election administration confirmed; roster unresolved. Imported records: 0.

- County adopted an interlocal agreement to administer Elmo’s 2025 municipal election. This does not identify candidates or establish whether the election was ultimately held. Need filing list or cancellation resolution.
- [Source 1](https://www.utah.gov/pmn/files/1248435.pdf)

### [Huntington](https://www.electionsutah.org/places/emery/huntington/), [Emery County](https://www.electionsutah.org/places/emery/)

Status: Candidate records imported. Imported records: 4.

- Official 2025 filing list identifies one mayor and three council candidates. Filed status is used because this source does not certify election outcomes.
- [Leonard L. Norton](https://www.electionsutah.org/people/leonard-l-norton/) · 2025 · [Huntington Mayor](https://www.electionsutah.org/offices/huntington-mayor/) · Filed
- [Judd George Beagley](https://www.electionsutah.org/people/judd-george-beagley/) · 2025 · [Huntington City Council](https://www.electionsutah.org/offices/huntington-city-council/) · Filed
- [Tom Kay](https://www.electionsutah.org/people/tom-kay/) · 2025 · [Huntington City Council](https://www.electionsutah.org/offices/huntington-city-council/) · Filed
- [Devin Lee Wilson](https://www.electionsutah.org/people/devin-lee-wilson/) · 2025 · [Huntington City Council (2-Year Term)](https://www.electionsutah.org/offices/huntington-city-council-2-year-term/) · Filed
- [Source 1](https://huntingtonut.com/wp-content/uploads/2026/01/Candidates-2025.pdf)

### [Antimony](https://www.electionsutah.org/places/garfield/antimony/), [Garfield County](https://www.electionsutah.org/places/garfield/)

Status: Vacancy notice found; election roster unresolved. Imported records: 0.

- The March 2025 notice concerns a council vacancy appointment, not a public election candidate roster. No named election candidates inferred.
- [Source 1](https://www.utah.gov/pmn/sitemap/notice/979757.html)

### [Bryce Canyon City](https://www.electionsutah.org/places/garfield/bryce-canyon-city/), [Garfield County](https://www.electionsutah.org/places/garfield/)

Status: Candidate records imported. Imported records: 3.

- The official cancellation notice declares three named candidates elected in 2025.
- [Reuben Shiloh Syrett](https://www.electionsutah.org/people/reuben-shiloh-syrett/) · 2025 · [Bryce Canyon City Mayor](https://www.electionsutah.org/offices/bryce-canyon-city-mayor/) · Elected unopposed; election cancelled
- [Gary Syrett](https://www.electionsutah.org/people/gary-syrett/) · 2025 · [Bryce Canyon City City Council](https://www.electionsutah.org/offices/bryce-canyon-city-city-council/) · Elected unopposed; election cancelled
- [Michael Stevens](https://www.electionsutah.org/people/michael-stevens/) · 2025 · [Bryce Canyon City City Council](https://www.electionsutah.org/offices/bryce-canyon-city-city-council/) · Elected unopposed; election cancelled
- [Source 1](https://www.utah.gov/pmn/sitemap/notice/1023411.html)

### [Escalante](https://www.electionsutah.org/places/garfield/escalante/), [Garfield County](https://www.electionsutah.org/places/garfield/)

Status: Candidate records imported. Imported records: 3.

- The September 2 cancellation notice names the mayor and two council candidates elected.
- [Melani Torgersen](https://www.electionsutah.org/people/melani-torgersen/) · 2025 · [Escalante Mayor](https://www.electionsutah.org/offices/escalante-mayor/) · Elected unopposed; election cancelled
- [A. Chad Lyman](https://www.electionsutah.org/people/a-chad-lyman/) · 2025 · [Escalante City Council](https://www.electionsutah.org/offices/escalante-city-council/) · Elected unopposed; election cancelled
- [Sally Orme](https://www.electionsutah.org/people/sally-orme/) · 2025 · [Escalante City Council](https://www.electionsutah.org/offices/escalante-city-council/) · Elected unopposed; election cancelled
- [Source 1](https://www.utah.gov/pmn/files/1317575.pdf)

### [Hatch](https://www.electionsutah.org/places/garfield/hatch/), [Garfield County](https://www.electionsutah.org/places/garfield/)

Status: Candidate records imported. Imported records: 3.

- The June 16, 2021 council minutes, item 5.3, explicitly report Tony Dinges filed for mayor and Jon Spendlove and Kevin Eldredge filed for council. These are imported as filed candidates; the minutes describe cancellation as conditional on no write-in filings and do not establish final results.
- The actual two-page 2025 cancellation resolution was located in the official public media archive. Its main heading is Resolution 2025-12, approved September 24, 2025; its second-page header and approved September minutes use 2025-06. It cancels the November 4, 2025 election and declares unopposed candidates elected, but names no candidates. The 2025 election notice advertises two four-year council seats. The 2025 candidate roster remains unresolved; voting council members and current incumbents are not treated as candidates.
- [Tony Dinges](https://www.electionsutah.org/people/tony-dinges/) · 2021 · [Mayor](https://www.electionsutah.org/offices/mayor/) · Filed — June 16, 2021 council election update
- [Jon Spendlove](https://www.electionsutah.org/people/jon-spendlove/) · 2021 · [Town Council](https://www.electionsutah.org/offices/town-council/) · Filed — June 16, 2021 council election update
- [Kevin Eldredge](https://www.electionsutah.org/people/kevin-eldredge/) · 2021 · [Town Council](https://www.electionsutah.org/offices/town-council/) · Filed — June 16, 2021 council election update
- [Source 1](https://hatchutah.gov/)
- [Source 2](https://hatchutah.gov/wp-content/uploads/2021/10/minJune1621.pdf)
- [Source 3](https://hatchutah.gov/wp-content/uploads/2025/10/CancelingElectionsPG1_000234.pdf)
- [Source 4](https://hatchutah.gov/wp-content/uploads/2025/10/CancelingElectionsPG2_000235.pdf)
- [Source 5](https://hatchutah.gov/wp-content/uploads/2025/04/Election-notice-2025.pdf)
- [Source 6](https://hatchutah.gov/wp-content/uploads/2025/12/September2025Minutes-APPROVED.pdf)

### [Castle Valley](https://www.electionsutah.org/places/grand/castle-valley/), [Grand County](https://www.electionsutah.org/places/grand/)

Status: Candidate records imported. Imported records: 3.

- The county UOCAVA notice lists three 2025 municipal candidates; no outcome is inferred from this filing-stage source.
- [Jasmine A. Duncan](https://www.electionsutah.org/people/jasmine-a-duncan/) · 2025 · [Castle Valley Mayor](https://www.electionsutah.org/offices/castle-valley-mayor/) · Filed
- [Robert Malcolm O’Brien](https://www.electionsutah.org/people/robert-malcolm-o-brien/) · 2025 · [Castle Valley Town Council](https://www.electionsutah.org/offices/castle-valley-town-council/) · Filed
- [Harry L. Holland](https://www.electionsutah.org/people/harry-l-holland/) · 2025 · [Castle Valley Town Council](https://www.electionsutah.org/offices/castle-valley-town-council/) · Filed
- [Source 1](https://grandcountyutah.gov/DocumentCenter/View/22917/Updated-UOCAVA-Election-Notice-9425)

### [Alton](https://www.electionsutah.org/places/kane/alton/), [Kane County](https://www.electionsutah.org/places/kane/)

Status: County source located; roster unresolved. Imported records: 0.

- Official county election information identifies Alton as a voting/drop-box location. It does not name municipal candidates. Need town filing or cancellation records; do not infer candidacies from current officials.
- [Source 1](https://kane.utah.gov/311/Elections)

### [Lynndyl](https://www.electionsutah.org/places/millard/lynndyl/), [Millard County](https://www.electionsutah.org/places/millard/)

Status: Election notice found; roster unresolved. Imported records: 0.

- Official 2023 notice announces two council seats and filing period, but does not name filed candidates. Need declaration list or adopted cancellation records.
- [Source 1](https://lynndyl.utah.gov/2023-lynndyl-town-municipal-election-notice/)

### [Meadow](https://www.electionsutah.org/places/millard/meadow/), [Millard County](https://www.electionsutah.org/places/millard/)

Status: Candidate records imported. Imported records: 3.

- The September cancellation notice names the mayor and two council candidates elected.
- [Gary Bishop](https://www.electionsutah.org/people/gary-bishop/) · 2025 · [Meadow Mayor](https://www.electionsutah.org/offices/meadow-mayor/) · Elected unopposed; election cancelled
- [Jim Beckstrand](https://www.electionsutah.org/people/jim-beckstrand/) · 2025 · [Meadow Town Council](https://www.electionsutah.org/offices/meadow-town-council/) · Elected unopposed; election cancelled
- [Robert H. Beckstrand](https://www.electionsutah.org/people/robert-h-beckstrand/) · 2025 · [Meadow Town Council](https://www.electionsutah.org/offices/meadow-town-council/) · Elected unopposed; election cancelled
- [Source 1](https://www.utah.gov/pmn/sitemap/notice/1023497.html)

### [Oak City](https://www.electionsutah.org/places/millard/oak-city/), [Millard County](https://www.electionsutah.org/places/millard/)

Status: Candidate records imported. Imported records: 4.

- The June 8, 2025 town filing notice names Kirt Lambert Dutson for mayor and Thomas S. Nielson, David K. Steele, and Shawn Owen Gonder for two four-year council seats. Millard County records Steele’s withdrawal on August 11, 2025.
- Signed Resolution 2025-06, adopted September 18, 2025, cancels the November 4 election and certifies Dutson, Nielson, and Gonder elected unopposed to four-year terms beginning January 2026. The resolution spells Gonder’s first name “Sean”; the town filing notices and county declaration/finance listings use “Shawn”, retained here. No vote totals are implied by the cancellation.
- [Kirt Lambert Dutson](https://www.electionsutah.org/people/kirt-lambert-dutson/) · 2025 · [Mayor](https://www.electionsutah.org/offices/mayor/) · Elected unopposed — Resolution 2025-06
- [Thomas S. Nielson](https://www.electionsutah.org/people/thomas-s-nielson/) · 2025 · [Town Council](https://www.electionsutah.org/offices/town-council/) · Elected unopposed — Resolution 2025-06
- [Shawn Owen Gonder](https://www.electionsutah.org/people/shawn-owen-gonder/) · 2025 · [Town Council](https://www.electionsutah.org/offices/town-council/) · Elected unopposed — Resolution 2025-06; filing records identify Shawn
- [David K. Steele](https://www.electionsutah.org/people/david-k-steele/) · 2025 · [Town Council](https://www.electionsutah.org/offices/town-council/) · Withdrew August 11, 2025
- [Source 1](https://www.utah.gov/pmn/sitemap/notice/1026133.html)
- [Source 2](https://www.utah.gov/pmn/sitemap/notice/1001043.html)
- [Source 3](https://millardcounty.gov/your-government/elected-officials/clerk/elections/2025-municipal-election-candidates/)
- [Source 4](https://millardcounty.gov/wp-content/uploads/2025/09/Oak-City-Resolution-to-cancel-election.pdf)
- [Source 5](https://millardcounty.gov/wp-content/uploads/2025/08/Oak-City-David-K-Steele-Withdrawal-8-11-25.pdf)

### [Scipio](https://www.electionsutah.org/places/millard/scipio/), [Millard County](https://www.electionsutah.org/places/millard/)

Status: Election notice found; roster unresolved. Imported records: 0.

- Official notice identifies mayor and council offices up for election but no candidate names. A secondary agenda index suggests cancellation consideration; adoption and roster remain unverified.
- [Source 1](https://millardcounty.gov/wp-content/uploads/2025/05/Scipio-Town-Election-Notice-UOCAVA-25-1.pdf)

### [Kingston](https://www.electionsutah.org/places/piute/kingston/), [Piute County](https://www.electionsutah.org/places/piute/)

Status: Cancellation lead; primary source unresolved. Imported records: 0.

- Secondary meeting index lists an October 2025 municipal-election cancellation attachment. Need the original Utah Public Notice attachment and named candidates.
- [Source 1](https://muniwatch.org/meetings/cmkqkpt77029bs75n8cov6x70)

### [Glenwood](https://www.electionsutah.org/places/sevier/glenwood/), [Sevier County](https://www.electionsutah.org/places/sevier/)

Status: Candidate records imported. Imported records: 3.

- The official cancellation notice names the mayor and two council candidates elected.
- [Phil E. Singleton](https://www.electionsutah.org/people/phil-e-singleton/) · 2025 · [Glenwood Mayor](https://www.electionsutah.org/offices/glenwood-mayor/) · Elected unopposed; election cancelled
- [Ben Hill](https://www.electionsutah.org/people/ben-hill/) · 2025 · [Glenwood Town Council](https://www.electionsutah.org/offices/glenwood-town-council/) · Elected unopposed; election cancelled
- [Christopher Steven Johnson](https://www.electionsutah.org/people/christopher-steven-johnson/) · 2025 · [Glenwood Town Council](https://www.electionsutah.org/offices/glenwood-town-council/) · Elected unopposed; election cancelled
- [Source 1](https://www.utah.gov/pmn/sitemap/notice/1023135.html)

### [Stockton](https://www.electionsutah.org/places/tooele/stockton/), [Tooele County](https://www.electionsutah.org/places/tooele/)

Status: Candidate records imported. Imported records: 3.

- County election archive lists a signed 2019 Stockton municipal canvass. The document is a concrete backfill source; current officeholder pages alone do not establish candidate history.
- Visually verified the signed 2019 canvass: three named ballot candidates in council and mayor contests. Imported participation without inferring seat counts or winners. Later cycles still need research.
- [Jill McAfee](https://www.electionsutah.org/people/jill-mcafee/) · 2019 · [Stockton City Council](https://www.electionsutah.org/offices/stockton-city-council/) · General Election Candidate
- [Joe Johnston](https://www.electionsutah.org/people/joe-johnston/) · 2019 · [Stockton City Council](https://www.electionsutah.org/offices/stockton-city-council/) · General Election Candidate
- [Thomas KJ Karjola](https://www.electionsutah.org/people/thomas-kj-karjola/) · 2019 · [Stockton Mayor](https://www.electionsutah.org/offices/stockton-mayor/) · General Election Candidate
- [Source 1](https://electionarchive.tooeleco.gov/eng/docs/)
- [Source 2](https://electionarchive.tooeleco.gov/files/serve/75)

### [Vernon](https://www.electionsutah.org/places/tooele/vernon/), [Tooele County](https://www.electionsutah.org/places/tooele/)

Status: Candidate records imported. Imported records: 4.

- Official February minutes identify one mayor and two council seats for 2025, but a mayor’s stated intent to run is not a filed candidacy. The county archive also has 2019 Vernon canvass documents.
- Visually verified the signed 2019 canvass: two candidates for the two-year council contest and two for the four-year contest. Later municipal cycles still need research.
- [Robert Scott Livingston](https://www.electionsutah.org/people/robert-scott-livingston/) · 2019 · [Vernon Town Council (2-Year Term)](https://www.electionsutah.org/offices/vernon-town-council-2-year-term/) · General Election Candidate
- [Rodney R. Manzione](https://www.electionsutah.org/people/rodney-r-manzione/) · 2019 · [Vernon Town Council (2-Year Term)](https://www.electionsutah.org/offices/vernon-town-council-2-year-term/) · General Election Candidate
- [John Olson](https://www.electionsutah.org/people/john-olson/) · 2019 · [Vernon Town Council](https://www.electionsutah.org/offices/vernon-town-council/) · General Election Candidate
- [Darrell Ekker Holden](https://www.electionsutah.org/people/darrell-ekker-holden/) · 2019 · [Vernon Town Council](https://www.electionsutah.org/offices/vernon-town-council/) · General Election Candidate
- [Source 1](https://vernon.utah.gov/council-meeting-02-06-2025/)
- [Source 2](https://electionarchive.tooeleco.gov/files/serve/77)

### [Daniel](https://www.electionsutah.org/places/wasatch/daniel/), [Wasatch County](https://www.electionsutah.org/places/wasatch/)

Status: Candidate records imported. Imported records: 5.

- Official June filing list names five candidates. A later cancellation resolution is indexed on the town site, but its content is currently inaccessible (HTTP 406). These records reflect filing only; later withdrawals/outcomes remain unresolved.
- [Scott Kohler](https://www.electionsutah.org/people/scott-kohler/) · 2025 · [Daniel Mayor](https://www.electionsutah.org/offices/daniel-mayor/) · Filed
- [Eric Bennett](https://www.electionsutah.org/people/eric-bennett/) · 2025 · [Daniel Town Council (2-Year Term)](https://www.electionsutah.org/offices/daniel-town-council-2-year-term/) · Filed
- [Brooke Rose](https://www.electionsutah.org/people/brooke-rose/) · 2025 · [Daniel Town Council](https://www.electionsutah.org/offices/daniel-town-council/) · Filed
- [Stefanie Grady](https://www.electionsutah.org/people/stefanie-grady/) · 2025 · [Daniel Town Council](https://www.electionsutah.org/offices/daniel-town-council/) · Filed
- [Jon Blotter](https://www.electionsutah.org/people/jon-blotter/) · 2025 · [Daniel Town Council](https://www.electionsutah.org/offices/daniel-town-council/) · Filed
- [Source 1](https://danielutah.gov/wp-content/uploads/2025/06/2025-ELECTION-CANDIDATES_0001.pdf)

### [Independence](https://www.electionsutah.org/places/wasatch/independence/), [Wasatch County](https://www.electionsutah.org/places/wasatch/)

Status: Candidate records imported. Imported records: 4.

- September 9 adopted minutes record the cancellation, two unopposed council candidates, and withdrawals by Wayne Heaton (mayor) and Rose Heaton (council).
- Withdrawn candidates are preserved as withdrawn, not elected.
- [Will Duke](https://www.electionsutah.org/people/will-duke/) · 2025 · [Independence Town Council](https://www.electionsutah.org/offices/independence-town-council/) · Elected unopposed; election cancelled
- [Jim Tolbert](https://www.electionsutah.org/people/jim-tolbert/) · 2025 · [Independence Town Council](https://www.electionsutah.org/offices/independence-town-council/) · Elected unopposed; election cancelled
- [Wayne Heaton](https://www.electionsutah.org/people/wayne-heaton/) · 2025 · [Independence Mayor](https://www.electionsutah.org/offices/independence-mayor/) · Withdrew
- [Rose Heaton](https://www.electionsutah.org/people/rose-heaton/) · 2025 · [Independence Town Council](https://www.electionsutah.org/offices/independence-town-council/) · Withdrew
- [Source 1](https://www.utah.gov/pmn/files/1332495.pdf)

### [Bicknell](https://www.electionsutah.org/places/wayne/bicknell/), [Wayne County](https://www.electionsutah.org/places/wayne/)

Status: Candidate records imported. Imported records: 3.

- The cancellation notice names the mayor and two council candidates elected.
- [Noreen Johnson](https://www.electionsutah.org/people/noreen-johnson/) · 2025 · [Bicknell Mayor](https://www.electionsutah.org/offices/bicknell-mayor/) · Elected unopposed; election cancelled
- [Weston Johnson](https://www.electionsutah.org/people/weston-johnson/) · 2025 · [Bicknell Town Council](https://www.electionsutah.org/offices/bicknell-town-council/) · Elected unopposed; election cancelled
- [Kerry Stevens](https://www.electionsutah.org/people/kerry-stevens/) · 2025 · [Bicknell Town Council](https://www.electionsutah.org/offices/bicknell-town-council/) · Elected unopposed; election cancelled
- [Source 1](https://www.utah.gov/pmn/sitemap/notice/1021163.html)

### [Loa](https://www.electionsutah.org/places/wayne/loa/), [Wayne County](https://www.electionsutah.org/places/wayne/)

Status: Candidate records imported. Imported records: 3.

- Signed declarations were visually checked against scans from the official county document index. Filed status only; complete roster and later election outcomes remain to be verified.
- [Cody Douglas Grundy](https://www.electionsutah.org/people/cody-douglas-grundy/) · 2025 · [Loa Mayor](https://www.electionsutah.org/offices/loa-mayor/) · Filed
- [Donald Roy Bone](https://www.electionsutah.org/people/donald-roy-bone/) · 2025 · [Loa Town Council](https://www.electionsutah.org/offices/loa-town-council/) · Filed
- [Kori G. Brown](https://www.electionsutah.org/people/kori-g-brown/) · 2025 · [Loa Town Council (2-Year Term)](https://www.electionsutah.org/offices/loa-town-council-2-year-term/) · Filed
- [Source 1](https://waynecountyutah.gov/uploads/cody-douglas-grundy.pdf)
- [Source 2](https://waynecountyutah.gov/uploads/donald-roy-bone.pdf)
- [Source 3](https://waynecountyutah.gov/uploads/kori-g.-brown.pdf)

### [Lyman](https://www.electionsutah.org/places/wayne/lyman/), [Wayne County](https://www.electionsutah.org/places/wayne/)

Status: Candidate records imported. Imported records: 2.

- The signed August 19 write-in declaration supports a named council candidate. Remaining municipal roster and outcomes need review.
- Signed declarations were visually checked against scans from the official county document index. Filed status only; complete roster and later election outcomes remain to be verified.
- [Melanie O. Grundy](https://www.electionsutah.org/people/melanie-o-grundy/) · 2025 · [Lyman Town Board](https://www.electionsutah.org/offices/lyman-town-board/) · Write-in candidate filed
- [Burke Torgerson](https://www.electionsutah.org/people/burke-torgerson/) · 2025 · [Lyman Mayor](https://www.electionsutah.org/offices/lyman-mayor/) · Write-in candidate filed
- [Source 1](https://waynecountyutah.gov/uploads/2025-lyman-declaration-of-candidacy-melanie-o.-grundy.pdf)
- [Source 2](https://waynecountyutah.gov/uploads/2025-lyman-delaration-of-candidacy-burke-torgerson.pdf)

### [Torrey](https://www.electionsutah.org/places/wayne/torrey/), [Wayne County](https://www.electionsutah.org/places/wayne/)

Status: Candidate records imported. Imported records: 3.

- Signed declarations were visually checked against scans from the official county document index. Filed status only; complete roster and later election outcomes remain to be verified.
- [Mickey Wright](https://www.electionsutah.org/people/mickey-wright/) · 2025 · [Torrey Mayor](https://www.electionsutah.org/offices/torrey-mayor/) · Filed
- [Renee Dawn Reel](https://www.electionsutah.org/people/renee-dawn-reel/) · 2025 · [Torrey Town Council](https://www.electionsutah.org/offices/torrey-town-council/) · Write-in candidate filed
- [Sheila Patricia Kearney](https://www.electionsutah.org/people/sheila-patricia-kearney/) · 2025 · [Torrey Town Council](https://www.electionsutah.org/offices/torrey-town-council/) · Filed
- [Source 1](https://waynecountyutah.gov/uploads/mickey-wright.pdf)
- [Source 2](https://waynecountyutah.gov/uploads/renee-dawn-reel.pdf)
- [Source 3](https://waynecountyutah.gov/uploads/sheila-patricia-kearney.pdf)

## Confirmed source and workflow gaps

- New Harmony: imported named municipal candidates for 2017 and 2019. The 2025 cancellation resolution does not name its candidates, so that roster remains unresolved.
- New Harmony: the 2024 vacancy appointment is retained as an official-source note, not counted as an election filing.
- New Harmony Valley Fire SSD: seven 2021 primary candidates corroborated against the county primary PDF; six also appear in the county general summary. Those six records use the later general-election stage. No winner status or vote totals are inferred.
- The state results importer starts in 2023. It cannot supply the missing pre-2023 municipal or special-district history.
- Results-only imports miss unopposed candidates when an election is cancelled. Filing lists and cancellation notices require separate research.
- The 2013 and 2015 municipal imports cover Salt Lake County only; zero records elsewhere are a known geographic limitation.
- Washington County’s previous-results index provides 2019 CSV and 2021 primary/general summaries and CSV exports. These are concrete sources for a broader county backfill.

[Washington County previous election results](https://www.washco.utah.gov/departments/clerk/elections/previous-election-results/)

## Database inventory

| Year | Candidate records across all sections |
| --- | ---: |
| 2013 | 160 |
| 2014 | 269 |
| 2015 | 106 |
| 2016 | 291 |
| 2017 | 209 |
| 2018 | 372 |
| 2019 | 24 |
| 2020 | 313 |
| 2021 | 10 |
| 2022 | 208 |
| 2023 | 1151 |
| 2024 | 827 |
| 2025 | 1564 |
| 2026 | 866 |

Full per-place and per-year counts and section inventory are in municipal-coverage-audit.json. This audit measures municipal coverage, not completeness within a recorded race or statewide filing-list completeness.
