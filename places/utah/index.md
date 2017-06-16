---
layout: page
title: Utah County
permalink: /places/utah/
---

- [American Fork](american-fork)
- [Highland](highland)
- [Lehi](lehi)
- [Orem](orem)
- [Provo](provo)
- [Saratoga Springs](saratoga-springs)
- [Spanish Fork](spanish-fork)
- [Springville](springville)

### Primary Candidates
{% assign county = site.data.2017.primary.candidates | where:'county','Utah' %}
{% for member in county  %}
- <strong>[{{member.name}}](/people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>{{ member.city }}, {{ member.county }}, {{ member.state }}</strong>
{% endfor %}
