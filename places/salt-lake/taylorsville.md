---
layout: page
title: Taylorsville
permalink: /places/salt-lake/taylorsville/
---

### Primary Candidates
{% assign city = site.data.2017.primary.candidates | where:'city','Taylorsville' %}
{% for member in city  %}
- <strong>[{{member.name}}](../../../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>{{ member.city }}, {{ member.county }}, {{ member.state }}</strong>
{% endfor %}
