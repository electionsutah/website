---
layout: page
title: People
permalink: /people/
comments: true
---

### 2017 Municipal Election
#### Primary Candidates
{% for member in site.data.2017.primary.candidates | where: 'id', page.person | first %}
- <strong>[{{member.name}}]({{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>[{{ member.city }}](../places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}), [{{ member.county }}](../places/{{ member.county | downcase | replace: ' ','-' }}), {{ member.state }}</strong>
{% endfor %}
