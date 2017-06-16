---
layout: page
title: Sandy
permalink: /places/salt-lake/sandy/
---

### Primary Candidates
{% assign city = site.data.2017.primary.candidates | where:'city','Sandy' %}
{% for member in city  %}
- <strong>[{{member.name}}](/../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>{{ member.city }}, {{ member.county }}, {{ member.state }}</strong>
{% endfor %}
