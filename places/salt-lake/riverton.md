---
layout: page
title: Riverton
permalink: /places/salt-lake/riverton/
---

### Primary Candidates
{% assign city = site.data.2017.primary.candidates | where:'city','Riverton' %}
{% for member in city  %}
- <strong>[{{member.name}}](../../../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>{{ member.city }}, [{{ member.county }}](../../../places/{{ member.county | downcase | replace: ' ','-' }}), [{{ member.state }}](../../../places)</strong>
{% endfor %}
