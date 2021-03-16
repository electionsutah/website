---
title: Schema
permalink: "/docs/schema/"
layout: page
comments: false
---

<nav class="content-nav">
  <a href="#person">Person</a>
</nav>

## Person

```
person
  id
  full_name
  first_names
  last_names
  gender
  identifiers
  image
  {YYYY}_election
    election_type
    incumbent: { yes }
    office
    candidate_status: {
                        filed
                        defeated
                        disqualified
                        elected
                        general_election
                        primary_election
                        withdrew
                      }
    address
    latitude
    longitude
    city
    county
    state
    zip
    phone
    donate
    email
    facebook
    twitter
    website
    youtube
    party
    documents
      document_{###}
    endorsements
      endorsement_{###}
    source
  last_updated
```