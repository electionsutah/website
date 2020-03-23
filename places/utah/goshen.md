---
title: Goshen
permalink: "/places/utah/goshen/"
layout: page
---

### 2018 Election

{% include 2018-elections.html %}

#### 2018 Primary Candidates
{% assign city = site.data.2018.primary.candidates | where:'city','Goshen' | sort: 'last_name' %}
<table>
<thead>
  <th>First Name</th>
  <th>Last Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in city  %}
  <tr>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_name }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_name }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>
