---
layout: page
title: Schema
permalink: /docs/schema/
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
    candidate_status: { filed, defeated, disqualified, elected, withdrew }
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
    endorsements
    source
  last_updated
```