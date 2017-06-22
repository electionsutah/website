---
layout: page
title: Cedar Hills
permalink: /places/utah/cedar-hills/
---

### 2017 Primary Candidates
{% assign city = site.data.2017.primary.candidates | where:'city','Cedar Hills' | sort:'name' %}
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