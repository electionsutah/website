---
title: City Council
permalink: "/office/city-council"
layout: page
comments: true
---

### 2019 Election

{% include 2019-municipal-elections.html %}

#### 2019 Municipal Elections
{% assign office = site.data.2019.candidates | where:'office','City Council' | sort:'last_name' %}
<table>
<thead>
  <th>First Names</th>
  <th>Last Names</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in office  %}
  <tr>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_names }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_names }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>