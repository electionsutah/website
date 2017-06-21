---
layout: page
title: Highland
permalink: /places/utah/highland/
---

### Primary Candidates
{% assign city = site.data.2017.primary.candidates | where:'city','Highland' %}
{% for member in city  %}
- <strong>[{{member.name}}](../../../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>{{ member.city }}, [{{ member.county }}](../../../places/{{ member.county | downcase | replace: ' ','-' }}), [{{ member.state }}](../../../places)</strong>
{% endfor %}
