---
layout: page
title: Cottonwood Heights
permalink: /places/salt-lake/cottonwood-heights/
---

### 2018 Primary Candidates

{% include 2018-elections.html %}

{% assign city = site.data.2017.primary.candidates | where:'city','Cottonwood Heights' | sort:'name' %}
<table>
<thead>
  <th>Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in city  %}
  <tr>
    <td><a href="../../../people/{{member.id}}">{{member.name}}</a></td>
    <td>{{ member.body }}</td>
    <td><a href="../../../places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="../../../places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>
