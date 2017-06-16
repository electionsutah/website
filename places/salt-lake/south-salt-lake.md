---
layout: page
title: South Salt Lake
permalink: /places/salt-lake/south-salt-lake/
---

### Primary Candidates
{% assign city = site.data.2017.primary.candidates | where:'city','South Salt Lake' %}
{% for member in city  %}
- <strong>[{{member.name}}](/../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>{{ member.city }}, {{ member.county }}, {{ member.state }}</strong>
{% endfor %}
