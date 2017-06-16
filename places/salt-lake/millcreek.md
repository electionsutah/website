---
layout: page
title: Millcreek
permalink: /places/salt-lake/millcreek/
---

### Primary Candidates
{% assign city = site.data.2017.primary.candidates | where:'city','Millcreek' %}
{% for member in city  %}
- <strong>[{{member.name}}](../../../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>{{ member.city }}, {{ member.county }}, {{ member.state }}</strong>
{% endfor %}
