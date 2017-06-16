---
layout: page
title: Salt Lake City
permalink: /places/salt-lake/salt-lake-city/
---

### Primary Candidates
{% assign city = site.data.2017.primary.candidates | where:'city','Salt Lake City' %}
{% for member in city  %}
- <strong>[{{member.name}}](../../../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>{{ member.city }}, [{{ member.county }}](../../../places/{{ member.county | downcase | replace: ' ','-' }}), {{ member.state }}</strong>
{% endfor %}
