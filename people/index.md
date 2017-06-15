---
layout: page
title: People
permalink: /people/
---

### 2017 Municipal Election
#### Primary Candidates
{% for member in site.data.2017.primary.candidates | where: 'id', page.person | first %}
- [{{member.name}}]({{member.id}})
{% endfor %}
