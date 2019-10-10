---
layout: page
title: Schema
permalink: /docs/schema/
comments: false
---

```
person
  id
  full_name
  first_names
  last_names
  gender
  election_2018
    election_type
    office
    candidate_status: { defeated, disqualified, elected, withdrew }
    address
    latitude
    longitude
    city
    county
    state
    zip
    phone
    crowdpac
    email
    facebook
    twitter
    website
    party
    source
  last_updated
```