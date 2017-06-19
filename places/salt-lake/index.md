---
layout: page
title: Salt Lake County
permalink: /places/salt-lake/
comments: true
---

- [Alta](alta)
- [Bluffdale](bluffdale)
- [Cottonwood Heights](cottonwood-heights)
- [Draper](draper)
- [Herriman](herriman)
- [Holladay](holladay)
- [Midvale](midvale)
- [Millcreek](millcreek)
- [Murray](murray)
- [Riverton](riverton)
- [Salt Lake City](salt-lake-city)
- [Sandy](sandy)
- [South Jordan](south-jordan)
- [South Salt Lake](south-salt-lake)
- [Taylorsville](taylorsville)
- [West Jordan](west-jordan)
- [West Valley City](west-valley-city)

### Primary Candidates
{% assign county = site.data.2017.primary.candidates | where:'county','Salt Lake' %}
{% for member in county  %}
- <strong>[{{member.name}}](../../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>[{{ member.city }}](../../places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}), [{{ member.county }}](../../places/{{ member.county | downcase | replace: ' ','-' }}), [{{ member.state }}](../../places)</strong>
{% endfor %}
