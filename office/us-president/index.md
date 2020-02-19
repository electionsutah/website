---
layout: page
title: U.S. President
permalink: /office/us-president
comments: true
---

### 2020 Elections

{% include 2020-elections.html %}

#### 2020 Presidential Primary Candidates
{% assign office = site.data.people | where:'election_2020.office','U.S. President' | sort:'last_names' %}
<table>
<thead>
  <th>First Name</th>
  <th>Last Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in office  %}
  <tr>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_names }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_names }}</a></td>
    <td>{{ member.election_2020.office }}</td>
    <td>{{ member.election_2020.city }}</td>
    <td>{{ member.election_2020.county }}</td>
  </tr>
{% endfor %}
</tbody>
</table>