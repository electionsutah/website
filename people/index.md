---
layout: page
title: People
permalink: /people/
---

### 2017 Municipal Election
#### Primary Candidates
{% for member in site.data.2017.primary.candidates | where: 'id', page.person | first %}
- <strong>[{{member.name}}]({{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>{{ member.city }}, {{ member.county }}, {{ member.state }}</strong>
{% endfor %}
