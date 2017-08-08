---
layout: page
title: Marriott-Slaterville
permalink: /places/weber/marriott-slaterville/
---

### 2017 Primary Candidates

<aside class="notice">
  <h4>Election Deadlines</h4>
  <ul>
    <li><strong><i class="fa fa-check-square"></i>&nbsp; Wednesday, 7 June 2017</strong> - Candidate Filing</li>
    <li><strong>August 15, 2017</strong> - Primary Election</li>
    <li><strong>November 7, 2017</strong> - General Election</li>
  </ul>
</aside>

{% assign city = site.data.2017.primary.candidates | where:'city','Marriott-Slaterville' | sort:'name' %}
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
