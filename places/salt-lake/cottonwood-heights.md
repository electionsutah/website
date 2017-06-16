---
layout: page
title: Cottonwood Heights
permalink: /places/salt-lake/cottonwood-heights/
---

### Primary Candidates
{% assign city = site.data.2017.primary.candidates | where:'city','Cottonwood Heights' %}
{% for member in city  %}
- <strong>[{{member.name}}](../../../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>{{ member.city }}, {{ member.county }}, {{ member.state }}</strong>
{% endfor %}
