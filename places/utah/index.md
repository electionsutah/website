---
layout: page
title: Utah County
permalink: /places/utah/
comments: true
---

- [Alpine](alpine)
- [American Fork](american-fork)
- [Cedar Fort](cedar-fort)
- [Cedar Hills](cedar-hills)
- [Eagle Mountain](eagle-mountain)
- [Elk Ridge](elk-ridge)
- [Fairfield](fairfield)
- [Genola](genola)
- [Goshen](goshen)
- [Highland](highland)
- [Lehi](lehi)
- [Lindon](lindon)
- [Mapleton](mapleton)
- [Orem](orem)
- [Payson](payson)
- [Pleasant Grove](pleasant-grove)
- [Provo](provo)
- [Salem](salem)
- [Santaquin](santaquin)
- [Saratoga Springs](saratoga-springs)
- [Spanish Fork](spanish-fork)
- [Springville](springville)
- [Vineyard](vineyard)
- [Woodland Hills](woodland-hills)

### Primary Candidates
{% assign county = site.data.2017.primary.candidates | where:'county','Utah' %}
{% for member in county  %}
- <strong>[{{member.name}}](../../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>[{{ member.city }}](../../places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}), [{{ member.county }}](../../places/{{ member.county | downcase | replace: ' ','-' }}), [{{ member.state }}](../../places)</strong>
{% endfor %}
