---
layout: page
title: West Valley City
permalink: /places/salt-lake/west-valley-city/
---

### Primary Candidates
{% assign city = site.data.2017.primary.candidates | where:'city','West Valley City' %}
{% for member in city  %}
- <strong>[{{member.name}}](../../../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>{{ member.city }}, [{{ member.county }}](../../../places/{{ member.county | downcase | replace: ' ','-' }}), {{ member.state }}</strong>
{% endfor %}
