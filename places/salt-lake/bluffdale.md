---
layout: page
title: Bluffdale
permalink: /places/salt-lake/bluffdale/
---

### Primary Candidates
{% assign city = site.data.2017.primary.candidates | where:'city','Bluffdale' %}
{% for member in city  %}
- <strong>[{{member.name}}](../../../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>{{ member.city }}, [{{ member.county }}](../../../places/{{ member.county | downcase | replace: ' ','-' }}), {{ member.state }}</strong>
{% endfor %}
